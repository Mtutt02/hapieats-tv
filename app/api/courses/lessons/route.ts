import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      sectionId?: string
      courseId?: string
      title?: string
      lessonType?: string
      position?: number
    }

    if (!body.sectionId || !body.courseId) {
      return NextResponse.json({ error: 'sectionId and courseId required' }, { status: 400 })
    }

    // Verify creator owns the course
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', body.courseId)
      .eq('creator_id', user.id)
      .single()

    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Verify section belongs to course
    const { data: section } = await supabase
      .from('course_sections')
      .select('id')
      .eq('id', body.sectionId)
      .eq('course_id', body.courseId)
      .single()

    if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

    const validTypes = ['video', 'live', 'text', 'quiz']
    const lessonType = validTypes.includes(body.lessonType ?? '') ? body.lessonType : 'video'

    const { data: lesson, error } = await supabase
      .from('course_lessons')
      .insert({
        section_id: body.sectionId,
        course_id: body.courseId,   // direct FK — required for progress/upload queries
        title: body.title?.trim() || 'New Lesson',
        lesson_type: lessonType,
        position: body.position ?? 0,
        is_preview: false,
      })
      .select()
      .single()

    if (error || !lesson) {
      console.error('[lessons] insert error:', error)
      return NextResponse.json({ error: 'Failed to create lesson' }, { status: 500 })
    }

    // Increment lesson_count on course
    const { data: courseData } = await supabase.from('courses').select('lesson_count').eq('id', body.courseId).single()
    if (courseData) {
      await supabase.from('courses').update({ lesson_count: (courseData.lesson_count ?? 0) + 1 }).eq('id', body.courseId)
    }

    return NextResponse.json({ lesson })
  } catch (err) {
    console.error('[lessons] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
