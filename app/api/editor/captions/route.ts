import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MUX_API = 'https://api.mux.com/video/v1'

function muxAuth() {
  const id = process.env.MUX_TOKEN_ID
  const secret = process.env.MUX_TOKEN_SECRET
  if (!id || !secret) return null
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64')
}

async function muxFetch(path: string, init?: RequestInit) {
  const auth = muxAuth()
  if (!auth) throw new Error('Mux credentials not configured')
  const res = await fetch(`${MUX_API}${path}`, {
    ...init,
    headers: { Authorization: auth, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.messages?.join(', ') || `Mux API error (${res.status})`)
  return json
}

/**
 * POST /api/editor/captions  { assetId }
 * Kicks off Mux auto-generated subtitles on the asset's audio track.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assetId } = await req.json()
    if (!assetId || typeof assetId !== 'string') {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 })
    }

    const asset = await muxFetch(`/assets/${assetId}`)
    const tracks: any[] = asset?.data?.tracks || []

    // already generated / generating?
    const existing = tracks.find(t => t.type === 'text' && t.text_source?.includes('generated'))
    if (existing) {
      return NextResponse.json({ status: existing.status === 'ready' ? 'ready' : 'processing' })
    }

    const audioTrack = tracks.find(t => t.type === 'audio')
    if (!audioTrack) return NextResponse.json({ error: 'Asset has no audio track' }, { status: 400 })

    await muxFetch(`/assets/${assetId}/tracks/${audioTrack.id}/generate-subtitles`, {
      method: 'POST',
      body: JSON.stringify({
        generated_subtitles: [{ language_code: 'en', name: 'English (auto)' }],
      }),
    })

    return NextResponse.json({ status: 'processing' })
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ error: e?.message ?? 'Caption request failed' }, { status: 500 })
  }
}

/**
 * GET /api/editor/captions?assetId=...
 * Returns { status, cues? } — cues parsed from the generated VTT once ready.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const assetId = req.nextUrl.searchParams.get('assetId')
    if (!assetId) return NextResponse.json({ error: 'assetId is required' }, { status: 400 })

    const asset = await muxFetch(`/assets/${assetId}`)
    const tracks: any[] = asset?.data?.tracks || []
    const textTrack = tracks.find(t => t.type === 'text')
    if (!textTrack) return NextResponse.json({ status: 'none' })
    if (textTrack.status !== 'ready') return NextResponse.json({ status: 'processing' })

    const playbackId = asset?.data?.playback_ids?.[0]?.id
    if (!playbackId) return NextResponse.json({ status: 'processing' })

    const vttRes = await fetch(`https://stream.mux.com/${playbackId}/text/${textTrack.id}.vtt`, { cache: 'no-store' })
    if (!vttRes.ok) return NextResponse.json({ status: 'processing' })
    const vtt = await vttRes.text()

    // parse VTT server-side
    const cues: Array<{ start: number; end: number; text: string }> = []
    const ts = (s: string) => {
      const m = s.trim().match(/(?:(\d+):)?(\d+):(\d+)\.(\d+)/)
      if (!m) return 0
      return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000
    }
    for (const block of vtt.replace(/\r/g, '').split('\n\n')) {
      const lines = block.split('\n').filter(Boolean)
      const i = lines.findIndex(l => l.includes('-->'))
      if (i < 0) continue
      const [a, b] = lines[i].split('-->')
      const text = lines.slice(i + 1).join('\n').trim()
      if (text) cues.push({ start: ts(a), end: ts(b), text })
    }

    return NextResponse.json({ status: 'ready', cues })
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ error: e?.message ?? 'Caption fetch failed' }, { status: 500 })
  }
}
