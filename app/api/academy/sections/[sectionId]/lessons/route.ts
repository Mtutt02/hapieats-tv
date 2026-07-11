import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { CourseLesson } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

// POST /api/academy/sections/[sectionId]/lessons — owner (via section→course) adds a lesson.
export async function POST(
  req: NextRequest,
  { params }: { params: { sectionId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: section } = await service
      .from('course_sections')
      .select('id, course_id')
      .eq('id', params.sectionId)
      .single()
    if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

    const { data: course } = await service.from('courses').select('creator_id').eq('id', section.course_id).single()
    if (!course || course.creator_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({})) as {
      title?: string
      description?: string | null
      video_id?: string | null
      order_index?: number
      is_free_preview?: boolean
    }

    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'New Lesson'
    const position = typeof body.order_index === 'number' && body.order_index >= 0 ? Math.round(body.order_index) : 0

    const { data: lesson, error } = await service
      .from('course_lessons')
      .insert({
        section_id: params.sectionId,
        course_id: section.course_id, // direct FK — required for progress/recipe queries
        title,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        video_id: typeof body.video_id === 'string' ? body.video_id : null,
        position,
        is_preview: body.is_free_preview === true,
        lesson_type: 'video',
        resources: [],
        chapters: [],
      })
      .select('id, section_id, title, description, video_id, mux_playback_id, position, is_preview, duration, resources, chapters')
      .single()

    if (error || !lesson) {
      console.error('[academy/lessons POST] DB error:', error)
      return NextResponse.json({ error: 'Failed to create lesson' }, { status: 500 })
    }

    const out: CourseLesson = {
      id: lesson.id,
      section_id: lesson.section_id,
      title: lesson.title,
      description: lesson.description ?? null,
      video_id: lesson.video_id ?? null,
      mux_playback_id: lesson.mux_playback_id ?? null,
      order_index: lesson.position ?? 0,
      is_free_preview: !!lesson.is_preview,
      duration: lesson.duration ?? null,
      resources: Array.isArray(lesson.resources) ? lesson.resources : [],
      chapters: Array.isArray(lesson.chapters) ? lesson.chapters : [],
      recipe: null,
    }
    return NextResponse.json({ lesson: out }, { status: 201 })
  } catch (err) {
    console.error('[academy/lessons POST] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
