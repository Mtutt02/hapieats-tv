import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { LessonResource, Chapter } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

// Resolve the owning course via lesson→section→course and verify ownership.
async function ownerOfLesson(lessonId: string, userId: string, service: ReturnType<typeof createServiceClient>) {
  const { data: lesson } = await service.from('course_lessons').select('id, section_id').eq('id', lessonId).single()
  if (!lesson) return { ok: false as const, status: 404, error: 'Lesson not found' }
  const { data: section } = await service.from('course_sections').select('course_id').eq('id', lesson.section_id).single()
  if (!section) return { ok: false as const, status: 404, error: 'Section not found' }
  const { data: course } = await service.from('courses').select('creator_id').eq('id', section.course_id).single()
  if (!course) return { ok: false as const, status: 404, error: 'Course not found' }
  if (course.creator_id !== userId) return { ok: false as const, status: 403, error: 'Forbidden' }
  return { ok: true as const }
}

function sanitizeResources(v: unknown): LessonResource[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .filter((r) => r && typeof r === 'object' && typeof (r as any).name === 'string' && typeof (r as any).url === 'string')
    .map((r) => {
      const o = r as any
      const res: LessonResource = { name: String(o.name), url: String(o.url) }
      if (typeof o.type === 'string') res.type = o.type
      return res
    })
}

function sanitizeChapters(v: unknown): Chapter[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .filter((c) => c && typeof c === 'object' && typeof (c as any).t === 'number' && typeof (c as any).label === 'string')
    .map((c) => ({ t: Number((c as any).t), label: String((c as any).label) }))
}

// PATCH /api/academy/lessons/[lessonId] — owner updates lesson fields.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { lessonId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const owner = await ownerOfLesson(params.lessonId, user.id, service)
    if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const updates: Record<string, unknown> = {}

    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim()
    if ('description' in body) updates.description = typeof body.description === 'string' ? body.description.trim() || null : null
    if ('video_id' in body) updates.video_id = typeof body.video_id === 'string' ? body.video_id : null
    if (typeof body.order_index === 'number' && body.order_index >= 0) updates.position = Math.round(body.order_index)
    if (typeof body.is_free_preview === 'boolean') updates.is_preview = body.is_free_preview
    const resources = sanitizeResources(body.resources)
    if (resources) updates.resources = resources
    const chapters = sanitizeChapters(body.chapters)
    if (chapters) updates.chapters = chapters

    if (!Object.keys(updates).length) return NextResponse.json({ ok: true })

    const { error } = await service.from('course_lessons').update(updates).eq('id', params.lessonId)
    if (error) {
      console.error('[academy/lessons/:id PATCH] DB error:', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[academy/lessons/:id PATCH] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE /api/academy/lessons/[lessonId] — owner only.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { lessonId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const owner = await ownerOfLesson(params.lessonId, user.id, service)
    if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

    const { error } = await service.from('course_lessons').delete().eq('id', params.lessonId)
    if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[academy/lessons/:id DELETE] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
