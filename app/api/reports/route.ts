import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetId, type, reason, detail, videoId } = await req.json()

  // Support both old (videoId) and new (targetId + type) shapes
  const resolvedType: string = type ?? 'video'
  const resolvedTarget: string = targetId ?? videoId

  if (!resolvedTarget || !reason) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Validate input lengths
  if (typeof reason !== 'string' || reason.length < 2 || reason.length > 200) {
    return NextResponse.json({ error: 'reason must be between 2 and 200 characters' }, { status: 400 })
  }
  if (detail !== undefined && detail !== null && (typeof detail !== 'string' || detail.length > 2000)) {
    return NextResponse.json({ error: 'detail must be 2000 characters or fewer' }, { status: 400 })
  }
  if (!['video', 'post', 'comment'].includes(resolvedType)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {
    reporter_id: user.id,
    reason,
    detail: detail ?? null,
    status: 'pending',
  }

  if (resolvedType === 'comment') {
    payload.comment_id = resolvedTarget
  } else {
    // video or post — both stored in the videos table
    payload.video_id = resolvedTarget
  }

  const { error } = await supabase.from('content_reports').insert(payload)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
