import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Verify user owns the lesson's course
async function verifyLessonOwner(supabase: ReturnType<typeof createClient>, userId: string, lessonId: string) {
  const { data } = await supabase
    .from('course_lessons')
    .select('id, section:course_sections!inner(course:courses!inner(creator_id))')
    .eq('id', lessonId)
    .single()

  if (!data) return false
  const section = data.section as { course: { creator_id: string } } | null
  return section?.course?.creator_id === userId
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { lessonId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const owns = await verifyLessonOwner(supabase, user.id, params.lessonId)
    if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json().catch(() => ({})) as {
      title?: string
      description?: string | null
      isPreview?: boolean
      lessonType?: string
      liveScheduledAt?: string | null
      durationSeconds?: number
    }

    const updates: Record<string, unknown> = {}
    if (body.title?.trim()) updates.title = body.title.trim()
    if ('description' in body) updates.description = body.description
    if ('isPreview' in body) updates.is_preview = body.isPreview
    if (body.lessonType) updates.lesson_type = body.lessonType
    if ('liveScheduledAt' in body) updates.live_scheduled_at = body.liveScheduledAt
    if (typeof body.durationSeconds === 'number') updates.duration_seconds = body.durationSeconds

    if (!Object.keys(updates).length) return NextResponse.json({ ok: true })

    const { error } = await supabase.from('course_lessons').update(updates).eq('id', params.lessonId)
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[lessons/PATCH] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { lessonId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const owns = await verifyLessonOwner(supabase, user.id, params.lessonId)
    if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Delete progress records first
    await supabase.from('lesson_progress').delete().eq('lesson_id', params.lessonId)
    const { error } = await supabase.from('course_lessons').delete().eq('id', params.lessonId)
    if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[lessons/DELETE] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
