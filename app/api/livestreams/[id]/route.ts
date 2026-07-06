import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface RouteParams {
  params: { id: string }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const supabase = createClient()

  const { data: liveStream } = await supabase
    .from('live_streams')
    .select(`
      id, title, description, status, mux_playback_id, mux_live_stream_id,
      started_at, ended_at, created_at,
      channel:channels(id, name, slug, thumbnail_url),
      creator:profiles(id, username, display_name, avatar_url)
    `)
    .eq('id', params.id)
    .single()

  if (!liveStream) {
    return NextResponse.json({ error: 'Live stream not found' }, { status: 404 })
  }

  // Check if requester is the owner — only then include stream_key
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: owned } = await supabase
      .from('live_streams')
      .select('stream_key')
      .eq('id', params.id)
      .eq('creator_id', user.id)
      .single()
    if (owned?.stream_key) {
      return NextResponse.json({ liveStream: { ...liveStream, stream_key: owned.stream_key } })
    }
  }

  return NextResponse.json({ liveStream })
}
