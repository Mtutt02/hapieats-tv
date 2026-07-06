import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const type = searchParams.get('type') ?? 'all'

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    )
  }

  const supabase = createClient()
  const trimmed = q.trim()

  let videos: unknown[] = []
  let channels: unknown[] = []

  if (type === 'videos' || type === 'all') {
    const { data, error } = await supabase
      .from('videos')
      .select(
        'id, title, description, thumbnail_url, mux_playback_id, view_count, created_at, channel:channels(id, name, slug), creator:profiles(id, username, display_name, avatar_url)'
      )
      .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
      .eq('status', 'ready')
      .eq('visibility', 'public')
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    videos = data ?? []
  }

  if (type === 'channels' || type === 'all') {
    const { data, error } = await supabase
      .from('channels')
      .select(
        'id, name, slug, description, thumbnail_url, subscriber_count, video_count, creator:profiles(id, username, display_name, avatar_url)'
      )
      .or(`name.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    channels = data ?? []
  }

  return NextResponse.json({ videos, channels, query: trimmed })
}
