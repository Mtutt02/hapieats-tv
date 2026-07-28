/**
 * POST /api/academy/lessons/[lessonId]/progress
 * Body: { seconds: number, completed?: boolean }
 *
 * Records watch engagement for a lesson. Auth required, and the caller must be
 * the course creator, enrolled, or an active Pro member (when the course is
 * pro-accessible). Watch minutes are stored as a MAX (never summed) per
 * (user, lesson, month) so replaying a lesson can't inflate the pool credits.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { lessonId: string } }) {
  try {
    const lessonId = params.lessonId
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const seconds = Number(body?.seconds)
    const completed = body?.completed === true
    if (!Number.isFinite(seconds) || seconds < 0) {
      return NextResponse.json({ error: 'seconds must be a non-negative number' }, { status: 400 })
    }

    const service = createServiceClient()

    // Resolve lesson → section → course (creator_id + course_id + pricing).
    const { data: lesson } = await service
      .from('course_lessons')
      .select('id, course_id, section_id, course:courses(id, creator_id, pricing_model, pro_included, status)')
      .eq('id', lessonId)
      .single()
    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const course = lesson.course as
      | { id: string; creator_id: string; pricing_model: string; pro_included: boolean; status: string }
      | null
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    const courseId = (lesson.course_id as string | null) ?? course.id

    // ── Access gate: creator OR enrolled OR (pro-accessible && Pro member) ──
    const isCreator = course.creator_id === user.id
    let enrolled = false
    let viaPro = false

    if (!isCreator) {
      const { data: enrollment } = await service
        .from('course_enrollments')
        .select('id, source')
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        .maybeSingle()
      enrolled = !!enrollment
      viaPro = (enrollment as { source?: string } | null)?.source === 'pro'

      if (!enrolled) {
        const proAccessible = course.pricing_model === 'pro_only' || course.pro_included === true
        if (proAccessible) {
          const { data: isPro } = await service.rpc('is_pro_member', { p_user_id: user.id })
          if (isPro === true) { viaPro = true }
          else return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
        } else {
          return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
        }
      }
    }

    const minutes = Math.round((seconds / 60) * 100) / 100
    const month = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

    // Upsert engagement — minutes accumulate as MAX (anti-gaming), completed sticks true.
    const { data: prior } = await service
      .from('academy_engagement')
      .select('id, minutes, completed')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .eq('month', month)
      .maybeSingle()

    const nextMinutes = Math.max(minutes, Number((prior as { minutes?: number } | null)?.minutes ?? 0))
    const nextCompleted = completed || ((prior as { completed?: boolean } | null)?.completed ?? false)

    if (prior?.id) {
      await service
        .from('academy_engagement')
        .update({ minutes: nextMinutes, completed: nextCompleted, via_pro: viaPro, updated_at: new Date().toISOString() })
        .eq('id', prior.id)
    } else {
      const { error: insErr } = await service.from('academy_engagement').insert({
        user_id: user.id,
        course_id: courseId,
        creator_id: course.creator_id,
        lesson_id: lessonId,
        month,
        minutes: nextMinutes,
        completed: nextCompleted,
        via_pro: viaPro,
      })
      // Ignore duplicate (unique user_id,lesson_id,month) races.
      if (insErr && (insErr as { code?: string }).code !== '23505') {
        console.error('[academy/progress] engagement insert error:', insErr)
        return NextResponse.json({ error: 'Failed to record progress' }, { status: 500 })
      }
    }

    // Best-effort: mirror latest progress onto the enrollment row if such a column exists.
    if (enrolled) {
      await service
        .from('course_enrollments')
        .update({ progress: nextMinutes })
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        // Swallow "column does not exist" — this mirror is optional.
        .then(({ error }) => { if (error && (error as { code?: string }).code !== '42703') { /* ignore */ } })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[academy/progress]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
