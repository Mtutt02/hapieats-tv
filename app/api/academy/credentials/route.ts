import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { certSerial, type CredentialTier } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

function randomCode(len = 10): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

// POST — issue a verifiable credential.
// Server-verified: EITHER the caller (student) has passed every required
// assessment on the course, OR the course owner is issuing it to a student
// who has completed the course. Serial + verification_code are server-generated.
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      courseId?: string
      userId?: string
      title?: string
    }

    const courseId = typeof body.courseId === 'string' ? body.courseId : ''
    if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })

    const { data: course } = await supabase
      .from('courses')
      .select('id, creator_id, title, certificate_tier, institution_id')
      .eq('id', courseId)
      .single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const isOwner = course.creator_id === user.id
    // Owner may issue to another student; otherwise the credential is for the caller.
    const recipientId = isOwner && typeof body.userId === 'string' && body.userId ? body.userId : user.id

    // Recipient must be enrolled in the course.
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', recipientId)
      .maybeSingle()
    if (!enrollment) {
      return NextResponse.json({ error: 'Recipient is not enrolled in this course' }, { status: 400 })
    }

    // Requirement check: every assessment on the course must be passed by the
    // recipient. (Owner issuing still requires the student to have passed.)
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id')
      .eq('course_id', courseId)

    const assessmentIds = (assessments ?? []).map((a) => a.id)
    if (assessmentIds.length > 0) {
      const { data: passed } = await supabase
        .from('assessment_submissions')
        .select('assessment_id, status')
        .eq('user_id', recipientId)
        .eq('status', 'passed')
        .in('assessment_id', assessmentIds)

      const passedSet = new Set((passed ?? []).map((s) => s.assessment_id))
      const allPassed = assessmentIds.every((id) => passedSet.has(id))
      if (!allPassed) {
        return NextResponse.json(
          { error: 'All course assessments must be passed before a credential can be issued' },
          { status: 400 },
        )
      }
    }

    // Accreditation partner from the institution, if any.
    let accreditationPartner: string | null = null
    if (course.institution_id) {
      const { data: inst } = await supabase
        .from('institutions')
        .select('accreditation_body')
        .eq('id', course.institution_id)
        .single()
      accreditationPartner = inst?.accreditation_body ?? null
    }

    const tier = (course.certificate_tier ?? 'skill') as CredentialTier
    const title = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : course.title

    // Service client for the insert (owner-issued credentials write for another user).
    const svc = createServiceClient()

    // Avoid duplicate credential for the same course/user/tier.
    const { data: existing } = await svc
      .from('credentials')
      .select('id, serial, verification_code')
      .eq('user_id', recipientId)
      .eq('course_id', courseId)
      .eq('tier', tier)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ credential: existing, alreadyIssued: true })
    }

    const { data: credential, error } = await svc
      .from('credentials')
      .insert({
        user_id: recipientId,
        course_id: courseId,
        institution_id: course.institution_id ?? null,
        tier,
        title,
        serial: certSerial(),
        verification_code: randomCode(10),
        accreditation_partner: accreditationPartner,
      })
      .select('id, serial, verification_code, tier, title, accreditation_partner, issued_at')
      .single()

    if (error || !credential) {
      console.error('[academy/credentials POST] DB error:', error)
      return NextResponse.json({ error: 'Failed to issue credential' }, { status: 500 })
    }

    return NextResponse.json({ credential })
  } catch (err) {
    console.error('[academy/credentials POST] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// GET — the caller's own credentials.
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: credentials, error } = await supabase
      .from('credentials')
      .select('id, course_id, program_id, institution_id, tier, title, serial, verification_code, accreditation_partner, issued_at, revoked')
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false })

    if (error) {
      console.error('[academy/credentials GET] DB error:', error)
      return NextResponse.json({ error: 'Failed to load credentials' }, { status: 500 })
    }

    return NextResponse.json({ credentials: credentials ?? [] })
  } catch (err) {
    console.error('[academy/credentials GET] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
