/**
 * /api/academy/courses/[courseId]/certificate
 *
 * POST — Issue (or return) the caller's certificate for a course. The course
 *        is "complete" when every non-preview lesson has a completed engagement
 *        row for this user. If complete and course.issues_certificate, a
 *        course_certificates row is upserted (idempotent on user+course+tier).
 * GET  — Return the caller's existing certificate for this course, if any.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { certSerial } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

function randomCode(len = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export async function GET(_req: NextRequest, { params }: { params: { courseId: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: cert } = await service
      .from('course_certificates')
      .select('*')
      .eq('course_id', params.courseId)
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({ certificate: cert ?? null })
  } catch (err) {
    console.error('[academy/certificate:GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest, { params }: { params: { courseId: string } }) {
  try {
    const courseId = params.courseId
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    const { data: course } = await service
      .from('courses')
      .select('id, issues_certificate, certificate_tier')
      .eq('id', courseId)
      .single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Already issued? — idempotent return.
    const { data: existing } = await service
      .from('course_certificates')
      .select('*')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) return NextResponse.json({ certificate: existing })

    if (!course.issues_certificate) {
      return NextResponse.json({ error: 'This course does not issue a certificate' }, { status: 400 })
    }

    // ── Completion check: every non-preview lesson has a completed engagement row ──
    const { data: lessons } = await service
      .from('course_lessons')
      .select('id, is_preview')
      .eq('course_id', courseId)
    const required = (lessons ?? []).filter((l) => l.is_preview !== true).map((l) => l.id as string)

    if (required.length === 0) {
      return NextResponse.json({ error: 'Course has no gradable lessons yet' }, { status: 400 })
    }

    const { data: done } = await service
      .from('academy_engagement')
      .select('lesson_id')
      .eq('user_id', user.id)
      .eq('completed', true)
      .in('lesson_id', required)

    const completedSet = new Set((done ?? []).map((d) => d.lesson_id as string))
    const isComplete = required.every((id) => completedSet.has(id))
    if (!isComplete) {
      return NextResponse.json(
        { error: 'Course not yet complete', completed: completedSet.size, total: required.length },
        { status: 400 },
      )
    }

    // ── Issue certificate (upsert idempotent on user+course+tier) ──
    const tier = course.certificate_tier ?? 'completion'
    const { data: cert, error: certErr } = await service
      .from('course_certificates')
      .upsert(
        {
          user_id: user.id,
          course_id: courseId,
          tier,
          serial: certSerial(),
          verification_code: randomCode(10),
        },
        { onConflict: 'user_id,course_id,tier', ignoreDuplicates: false },
      )
      .select('*')
      .single()

    if (certErr || !cert) {
      // Lost a race — return whatever now exists.
      const { data: after } = await service
        .from('course_certificates')
        .select('*')
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (after) return NextResponse.json({ certificate: after })
      console.error('[academy/certificate:POST] upsert error:', certErr)
      return NextResponse.json({ error: 'Failed to issue certificate' }, { status: 500 })
    }

    return NextResponse.json({ certificate: cert })
  } catch (err) {
    console.error('[academy/certificate:POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
