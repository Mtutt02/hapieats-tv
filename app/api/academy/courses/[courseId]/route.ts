import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  type CourseFormat,
  type CourseLevel,
  type PricingModel,
  type CredentialTier,
  type CourseLesson,
  type CourseSection,
} from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

const FORMATS: CourseFormat[] = ['recorded', 'live', 'hybrid']
const LEVELS: CourseLevel[] = ['beginner', 'intermediate', 'advanced', 'professional']
const PRICING: PricingModel[] = ['free', 'paid', 'pro_only']
const TIERS: CredentialTier[] = ['completion', 'skill', 'diploma']

const COURSE_COLS = 'id, creator_id, title, description, category, format, level, pricing_model, price, pro_included, issues_certificate, certificate_tier, requires_assessment, institution_id, thumbnail_url, estimated_minutes, enrollment_count, is_published, created_at'

// Map a raw lesson row (DB uses position/is_preview) to the CourseLesson contract.
function mapLesson(row: Record<string, any>, recipe: Record<string, any> | null): CourseLesson {
  return {
    id: row.id,
    section_id: row.section_id,
    title: row.title,
    description: row.description ?? null,
    video_id: row.video_id ?? null,
    mux_playback_id: row.mux_playback_id ?? null,
    order_index: row.position ?? 0,
    is_free_preview: !!row.is_preview,
    duration: row.duration ?? null,
    resources: Array.isArray(row.resources) ? row.resources : [],
    chapters: Array.isArray(row.chapters) ? row.chapters : [],
    recipe: recipe
      ? {
          id: recipe.id,
          course_id: recipe.course_id,
          lesson_id: recipe.lesson_id ?? null,
          title: recipe.title,
          is_master: !!recipe.is_master,
          servings: recipe.servings ?? null,
          prep_minutes: recipe.prep_minutes ?? null,
          cook_minutes: recipe.cook_minutes ?? null,
          ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
          steps: Array.isArray(recipe.steps) ? recipe.steps : [],
          notes: recipe.notes ?? null,
        }
      : null,
  }
}

// GET /api/academy/courses/[courseId] — full course, access-gated.
export async function GET(
  _req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const service = createServiceClient()

    const { data: course } = await service.from('courses').select(COURSE_COLS).eq('id', params.courseId).single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Access gate: full lessons visible if creator OR enrolled OR (pro_included && pro member).
    let fullAccess = false
    if (user) {
      if (user.id === course.creator_id) {
        fullAccess = true
      } else {
        const { data: enroll } = await service
          .from('course_enrollments')
          .select('id')
          .eq('course_id', course.id)
          .eq('user_id', user.id)
          .maybeSingle()
        if (enroll) {
          fullAccess = true
        } else if (course.pro_included) {
          const { data: isPro } = await service.rpc('is_pro_member', { p_user_id: user.id })
          if (isPro === true) fullAccess = true
        }
      }
    }

    const { data: sectionRows } = await service
      .from('course_sections')
      .select('id, course_id, title, position')
      .eq('course_id', course.id)
      .order('position', { ascending: true })

    const sectionIds = (sectionRows ?? []).map((s) => s.id)
    let lessonRows: Record<string, any>[] = []
    if (sectionIds.length) {
      const { data } = await service
        .from('course_lessons')
        .select('id, section_id, title, description, video_id, mux_playback_id, position, is_preview, duration, resources, chapters')
        .in('section_id', sectionIds)
        .order('position', { ascending: true })
      lessonRows = data ?? []
    }

    const { data: recipeRows } = await service
      .from('lesson_recipes')
      .select('*')
      .eq('course_id', course.id)
    const recipeByLesson = new Map<string, Record<string, any>>()
    for (const r of recipeRows ?? []) if (r.lesson_id) recipeByLesson.set(r.lesson_id, r)

    const sections: CourseSection[] = (sectionRows ?? []).map((s) => {
      const lessons = lessonRows
        .filter((l) => l.section_id === s.id)
        // Non-full-access viewers only see free-preview lessons; others see metadata only.
        .filter((l) => fullAccess || l.is_preview)
        .map((l) => mapLesson(l, recipeByLesson.get(l.id) ?? null))
      return { id: s.id, course_id: s.course_id, title: s.title, order_index: s.position ?? 0, lessons }
    })

    return NextResponse.json({ course, sections, access: fullAccess ? 'full' : 'preview' })
  } catch (err) {
    console.error('[academy/courses/:id GET] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

async function requireOwner(courseId: string, userId: string, service: ReturnType<typeof createServiceClient>) {
  const { data } = await service.from('courses').select('id, creator_id').eq('id', courseId).single()
  if (!data) return { ok: false as const, status: 404, error: 'Course not found' }
  if (data.creator_id !== userId) return { ok: false as const, status: 403, error: 'Forbidden' }
  return { ok: true as const }
}

// PATCH /api/academy/courses/[courseId] — owner updates any field.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const owner = await requireOwner(params.courseId, user.id, service)
    if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const updates: Record<string, unknown> = {}

    if (typeof body.title === 'string') {
      const t = body.title.trim()
      if (t.length < 3 || t.length > 120) return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
      updates.title = t
    }
    if ('description' in body) updates.description = typeof body.description === 'string' ? body.description.trim() || null : null
    if (typeof body.category === 'string' && body.category.trim()) updates.category = body.category.trim()
    if (FORMATS.includes(body.format as CourseFormat)) updates.format = body.format
    if (LEVELS.includes(body.level as CourseLevel)) updates.level = body.level
    if (PRICING.includes(body.pricing_model as PricingModel)) updates.pricing_model = body.pricing_model
    if (TIERS.includes(body.certificate_tier as CredentialTier)) updates.certificate_tier = body.certificate_tier
    if (typeof body.pro_included === 'boolean') updates.pro_included = body.pro_included
    if (typeof body.issues_certificate === 'boolean') updates.issues_certificate = body.issues_certificate
    if (typeof body.requires_assessment === 'boolean') updates.requires_assessment = body.requires_assessment
    if (typeof body.is_published === 'boolean') updates.is_published = body.is_published
    if (typeof body.thumbnail_url === 'string') updates.thumbnail_url = body.thumbnail_url.trim() || null
    if (typeof body.estimated_minutes === 'number' && body.estimated_minutes >= 0) updates.estimated_minutes = Math.round(body.estimated_minutes)
    if ('price' in body) {
      const raw = typeof body.price === 'number' ? body.price : parseFloat(String(body.price ?? 0))
      if (isNaN(raw) || raw < 0) return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
      updates.price = Math.round(raw * 100) / 100
    }

    if (!Object.keys(updates).length) return NextResponse.json({ ok: true })

    const { data: course, error } = await service
      .from('courses').update(updates).eq('id', params.courseId).select(COURSE_COLS).single()
    if (error) {
      console.error('[academy/courses/:id PATCH] DB error:', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
    return NextResponse.json({ course })
  } catch (err) {
    console.error('[academy/courses/:id PATCH] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE /api/academy/courses/[courseId] — owner only.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const owner = await requireOwner(params.courseId, user.id, service)
    if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

    const { error } = await service.from('courses').delete().eq('id', params.courseId)
    if (error) {
      console.error('[academy/courses/:id DELETE] DB error:', error)
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[academy/courses/:id DELETE] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
