import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { progressSeconds?: number; completed?: boolean }
    const progressSeconds = Math.max(0, Math.floor(body.progressSeconds ?? 0))
    const completed = body.completed === true

    // Verify lesson belongs to course using direct course_id FK
    const { data: lesson } = await supabase
      .from('course_lessons')
      .select('id, course_id')
      .eq('id', params.lessonId)
      .eq('course_id', params.courseId)
      .single()

    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    // Upsert progress — RLS ensures user can only write their own row
    const { error } = await supabase
      .from('lesson_progress')
      .upsert({
        user_id: user.id,
        lesson_id: params.lessonId,
        progress_seconds: progressSeconds,
        completed,
        ...(completed ? { completed_at: new Date().toISOString() } : {}),
      }, { onConflict: 'user_id,lesson_id' })

    if (error) {
      console.error('[lesson-progress] upsert error:', error)
      return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[lesson-progress] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
