import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { clipId: string }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/clips/[clipId]/view — increments view_count server-side.
// No auth required (guest views count), but rate limited per user/IP.
// Client counts are never trusted: always +1 on the DB value.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { clipId } = params
  if (!UUID_RE.test(clipId)) {
    return NextResponse.json({ error: 'Invalid clip id' }, { status: 400 })
  }

  // Prefer the authed user id as the rate-limit key, else request IP.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const rateKey = `${user?.id ?? ip}:clip-view`

  const rate = checkRateLimit(rateKey, 60, 60_000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const service = createServiceClient()

  const { data: clip, error: readError } = await service
    .from('videos')
    .select('id, view_count')
    .eq('id', clipId)
    .eq('is_clip', true)
    .maybeSingle()

  if (readError) {
    // is_clip column may not exist yet (migration not applied) — degrade gracefully
    return NextResponse.json({ success: true })
  }
  if (!clip) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
  }

  const currentCount: number = typeof clip.view_count === 'number' ? clip.view_count : 0
  await service
    .from('videos')
    .update({ view_count: currentCount + 1 })
    .eq('id', clipId)
    .eq('is_clip', true)

  return NextResponse.json({ success: true })
}
