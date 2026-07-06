import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { video } from '@/lib/mux'

export const runtime = 'nodejs'

// ── POST /api/live/end ─────────────────────────────────────────────────────────
// Creator-only: end an active live stream.
// Updates DB immediately and signals Mux to complete the live stream
// (which also terminates any active WHIP connection on the studio tab).
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { stream_id: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { stream_id } = body
  if (!stream_id) return NextResponse.json({ error: 'stream_id required' }, { status: 400 })

  const service = createServiceClient()

  // Fetch stream — verify ownership
  const { data: stream } = await service
    .from('live_streams')
    .select('id, creator_id, status, mux_live_stream_id')
    .eq('id', stream_id)
    .single()

  if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 })

  if (stream.creator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (stream.status === 'ended') {
    return NextResponse.json({ success: true, message: 'Stream already ended' })
  }

  // Mark stream as ended in DB immediately so viewers see it
  const { error: dbErr } = await service
    .from('live_streams')
    .update({
      status:     'ended',
      ended_at:   new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', stream_id)

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  // Signal Mux to complete the stream (terminates the WHIP ingest)
  // This also triggers the video.live_stream.idle webhook, but DB is already updated.
  if (stream.mux_live_stream_id) {
    try {
      await video.liveStreams.complete(stream.mux_live_stream_id)
    } catch (muxErr) {
      // Non-fatal: DB is already updated. Log and continue.
      console.error('[live/end] Mux complete error:', muxErr)
    }
  }

  // Post a system message to chat so viewers see the stream ended
  await service.from('live_chat_messages').insert({
    stream_id,
    sender_id: user.id,   // creator is the sender for the system message
    message:   'The stream has ended. Thanks for watching! 👋',
    type:      'system',
    is_private: false,
  }).catch(() => { /* non-fatal */ })

  return NextResponse.json({ success: true })
}
