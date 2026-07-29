import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { youtubeUrl, title, description } = await request.json()

  if (!youtubeUrl || typeof youtubeUrl !== 'string') {
    return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 })
  }

  // Extract video ID from various YouTube URL formats
  let videoId: string | null = null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const pattern of patterns) {
    const match = youtubeUrl.match(pattern)
    if (match) { videoId = match[1]; break }
  }

  if (!videoId) {
    return NextResponse.json({ error: 'Invalid YouTube URL. Use a standard YouTube video link.' }, { status: 400 })
  }

  const finalTitle = title?.trim() || 'YouTube Video'
  const embedUrl = `https://www.youtube.com/embed/${videoId}`
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

  const { data: video, error } = await supabase
    .from('videos')
    .insert({
      creator_id: user.id,
      title: finalTitle,
      description: description?.trim() || null,
      youtube_url: watchUrl,
      thumbnail_url: thumbnailUrl,
      status: 'ready',
      visibility: 'public',
      pricing_model: 'free',
      post_type: 'general',
      published_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to add YouTube video:', error)
    return NextResponse.json({ error: 'Failed to save video' }, { status: 500 })
  }

  return NextResponse.json({ video })
}
