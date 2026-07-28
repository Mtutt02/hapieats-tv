import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/academy/courses/[courseId]/sections — owner adds a section.
export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: course } = await service.from('courses').select('id, creator_id').eq('id', params.courseId).single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (course.creator_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({})) as { title?: string; order_index?: number }
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return NextResponse.json({ error: 'Section title required' }, { status: 400 })

    const position = typeof body.order_index === 'number' && body.order_index >= 0 ? Math.round(body.order_index) : 0

    const { data: section, error } = await service
      .from('course_sections')
      .insert({ course_id: params.courseId, title, position })
      .select('id, course_id, title, position')
      .single()

    if (error || !section) {
      console.error('[academy/sections POST] DB error:', error)
      return NextResponse.json({ error: 'Failed to create section' }, { status: 500 })
    }

    return NextResponse.json({
      section: { id: section.id, course_id: section.course_id, title: section.title, order_index: section.position ?? 0, lessons: [] },
    }, { status: 201 })
  } catch (err) {
    console.error('[academy/sections POST] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
