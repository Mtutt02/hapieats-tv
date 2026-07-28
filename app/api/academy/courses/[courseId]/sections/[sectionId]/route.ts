import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Verify the caller owns the course AND the section belongs to it.
async function guard(courseId: string, sectionId: string, userId: string, service: ReturnType<typeof createServiceClient>) {
  const { data: course } = await service.from('courses').select('id, creator_id').eq('id', courseId).single()
  if (!course) return { ok: false as const, status: 404, error: 'Course not found' }
  if (course.creator_id !== userId) return { ok: false as const, status: 403, error: 'Forbidden' }
  const { data: section } = await service.from('course_sections').select('id').eq('id', sectionId).eq('course_id', courseId).single()
  if (!section) return { ok: false as const, status: 404, error: 'Section not found' }
  return { ok: true as const }
}

// PATCH /api/academy/courses/[courseId]/sections/[sectionId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { courseId: string; sectionId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const g = await guard(params.courseId, params.sectionId, user.id, service)
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

    const body = await req.json().catch(() => ({})) as { title?: string; order_index?: number }
    const updates: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim()
    if (typeof body.order_index === 'number' && body.order_index >= 0) updates.position = Math.round(body.order_index)

    if (!Object.keys(updates).length) return NextResponse.json({ ok: true })

    const { error } = await service.from('course_sections').update(updates).eq('id', params.sectionId)
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[academy/sections/:id PATCH] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE /api/academy/courses/[courseId]/sections/[sectionId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { courseId: string; sectionId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const g = await guard(params.courseId, params.sectionId, user.id, service)
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

    await service.from('course_lessons').delete().eq('section_id', params.sectionId)
    const { error } = await service.from('course_sections').delete().eq('id', params.sectionId)
    if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[academy/sections/:id DELETE] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
