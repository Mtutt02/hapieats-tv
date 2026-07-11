import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Ingredient } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

// Resolve course_id from lesson→section, and whether the caller owns it.
async function resolveLesson(lessonId: string, service: ReturnType<typeof createServiceClient>) {
  const { data: lesson } = await service.from('course_lessons').select('id, section_id').eq('id', lessonId).single()
  if (!lesson) return null
  const { data: section } = await service.from('course_sections').select('course_id').eq('id', lesson.section_id).single()
  if (!section) return null
  const { data: course } = await service.from('courses').select('id, creator_id').eq('id', section.course_id).single()
  if (!course) return null
  return { courseId: course.id as string, creatorId: course.creator_id as string }
}

function sanitizeIngredients(v: unknown): Ingredient[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((i) => i && typeof i === 'object' && typeof (i as any).item === 'string' && (i as any).item.trim())
    .map((i) => {
      const o = i as any
      const ing: Ingredient = { item: String(o.item).trim() }
      if (typeof o.qty === 'string') ing.qty = o.qty
      if (typeof o.unit === 'string') ing.unit = o.unit
      if (typeof o.note === 'string') ing.note = o.note
      return ing
    })
}

function sanitizeSteps(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((s) => typeof s === 'string' && s.trim()).map((s) => String(s))
}

// GET /api/academy/lessons/[lessonId]/recipe — public read of the lesson's recipe.
export async function GET(
  _req: NextRequest,
  { params }: { params: { lessonId: string } },
) {
  try {
    const service = createServiceClient()
    const { data: recipe } = await service
      .from('lesson_recipes')
      .select('*')
      .eq('lesson_id', params.lessonId)
      .maybeSingle()
    return NextResponse.json({ recipe: recipe ?? null })
  } catch (err) {
    console.error('[academy/lesson recipe GET] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PUT /api/academy/lessons/[lessonId]/recipe — owner upserts the lesson's recipe.
export async function PUT(
  req: NextRequest,
  { params }: { params: { lessonId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const resolved = await resolveLesson(params.lessonId, service)
    if (!resolved) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    if (resolved.creatorId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : ''
    if (!title) return NextResponse.json({ error: 'Recipe title required' }, { status: 400 })

    const payload = {
      course_id: resolved.courseId,
      lesson_id: params.lessonId,
      title,
      is_master: body.is_master === true,
      servings: typeof body.servings === 'number' ? Math.round(body.servings) : null,
      prep_minutes: typeof body.prep_minutes === 'number' ? Math.round(body.prep_minutes) : null,
      cook_minutes: typeof body.cook_minutes === 'number' ? Math.round(body.cook_minutes) : null,
      ingredients: sanitizeIngredients(body.ingredients),
      steps: sanitizeSteps(body.steps),
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      updated_at: new Date().toISOString(),
    }

    // Upsert: one recipe per lesson.
    const { data: existing } = await service.from('lesson_recipes').select('id').eq('lesson_id', params.lessonId).maybeSingle()

    let recipe
    if (existing) {
      const { data, error } = await service.from('lesson_recipes').update(payload).eq('id', existing.id).select('*').single()
      if (error) { console.error('[academy/lesson recipe PUT] update error:', error); return NextResponse.json({ error: 'Save failed' }, { status: 500 }) }
      recipe = data
    } else {
      const { data, error } = await service.from('lesson_recipes').insert(payload).select('*').single()
      if (error) { console.error('[academy/lesson recipe PUT] insert error:', error); return NextResponse.json({ error: 'Save failed' }, { status: 500 }) }
      recipe = data
    }

    return NextResponse.json({ recipe })
  } catch (err) {
    console.error('[academy/lesson recipe PUT] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
