import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

// ── GET /api/live/chat?stream_id=xxx&limit=50&before=<iso_timestamp> ──────────
// Returns public message history with joined sender profiles.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const streamId = searchParams.get('stream_id')
  if (!streamId) return NextResponse.json({ error: 'stream_id required' }, { status: 400 })

  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '60', 10), 100)
  const before = searchParams.get('before') // ISO timestamp for pagination

  const service = createServiceClient()

  let query = service
    .from('live_chat_messages')
    .select(`
      id, sender_id, message, type,
      gift_name, gift_emoji, gift_tokens,
      is_private, recipient_id, created_at,
      sender:sender_id ( username, display_name, avatar_url )
    `)
    .eq('stream_id', streamId)
    .eq('is_private', false)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ messages: data ?? [] })
}

// ── POST /api/live/chat ────────────────────────────────────────────────────────
// Send a public or private chat message.
// Body: { stream_id, message, is_private?, recipient_id? }
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`${user.id}:live-chat`, 20, 30_000)
  if (!rl.allowed) return NextResponse.json({ error: 'You are sending messages too fast.' }, { status: 429 })

  let body: {
    stream_id:    string
    message:      string
    is_private?:  boolean
    recipient_id?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { stream_id, message, is_private = false, recipient_id } = body

  if (!stream_id)  return NextResponse.json({ error: 'stream_id required' }, { status: 400 })
  if (!message)    return NextResponse.json({ error: 'message required' }, { status: 400 })
  if (typeof message !== 'string') {
    return NextResponse.json({ error: 'message must be a string' }, { status: 400 })
  }

  const trimmed = message.trim()
  if (trimmed.length === 0)   return NextResponse.json({ error: 'message cannot be empty' }, { status: 400 })
  if (trimmed.length > 300)   return NextResponse.json({ error: 'message too long (max 300 chars)' }, { status: 400 })

  if (is_private && !recipient_id) {
    return NextResponse.json({ error: 'recipient_id required for private messages' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify stream exists and is active (don't allow chat after stream ends)
  const { data: stream } = await service
    .from('live_streams')
    .select('status')
    .eq('id', stream_id)
    .single()

  if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
  if (stream.status === 'ended') {
    return NextResponse.json({ error: 'Stream has ended' }, { status: 400 })
  }

  // Insert via service role (bypasses RLS type constraint so we can use type='message')
  const { data: inserted, error } = await service
    .from('live_chat_messages')
    .insert({
      stream_id,
      sender_id:    user.id,
      message:      trimmed,
      type:         'message',
      is_private,
      recipient_id: is_private ? recipient_id : null,
    })
    .select(`
      id, sender_id, message, type,
      is_private, recipient_id, created_at,
      sender:sender_id ( username, display_name, avatar_url )
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: inserted }, { status: 201 })
}
