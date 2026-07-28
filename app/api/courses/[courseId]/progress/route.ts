import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/courses/[courseId]/progress
// Returns the list of completed lesson IDs for the current user in a course
export async function GET(
  _req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ completedLessonIds: [] })

    // Get all lesson IDs in the course — course_lessons has a direct course_id FK
    const { data: lessons } = await supabase
      .from('course_lessons')
      .select('id')
      .eq('course_id', params.courseId)

    if (!lessons?.length) return NextResponse.json({ completedLessonIds: [] })
    const lessonIds = lessons.map(l => l.id)

    // Get completion records for this user
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .eq('completed', true)
      .in('lesson_id', lessonIds)

    return NextResponse.json({
      completedLessonIds: (progress ?? []).map(p => p.lesson_id),
    })
  } catch (err) {
    console.error('[course-progress] Error:', err)
    return NextResponse.json({ completedLessonIds: [] })
  }
}
