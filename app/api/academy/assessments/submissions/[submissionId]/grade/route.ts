import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — HUMAN grading of a practical submission by the course owner/instructor.
// Records status/score/feedback + grader_id + graded_at. Credential issuance is
// NOT done here — it lives in the credentials route.
export async function POST(
  req: NextRequest,
  { params }: { params: { submissionId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      status?: string
      score?: number
      feedback?: string | null
    }

    const status = body.status === 'passed' ? 'passed' : body.status === 'failed' ? 'failed' : ''
    if (!status) {
      return NextResponse.json({ error: 'status must be "passed" or "failed"' }, { status: 400 })
    }

    // Load submission → assessment → course, to verify grader owns the course.
    const { data: submission } = await supabase
      .from('assessment_submissions')
      .select('id, assessment_id, status')
      .eq('id', params.submissionId)
      .single()
    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

    const { data: assessment } = await supabase
      .from('assessments')
      .select('id, course_id')
      .eq('id', submission.assessment_id)
      .single()
    if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    const { data: course } = await supabase
      .from('courses')
      .select('id, creator_id')
      .eq('id', assessment.course_id)
      .single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    if (course.creator_id !== user.id) {
      return NextResponse.json({ error: 'Only the course instructor can grade' }, { status: 403 })
    }

    let score: number | null = null
    if (body.score !== undefined && body.score !== null) {
      const s = Number(body.score)
      if (Number.isFinite(s)) score = Math.min(100, Math.max(0, Math.round(s)))
    }

    const { data: graded, error } = await supabase
      .from('assessment_submissions')
      .update({
        status,
        score,
        feedback: body.feedback?.toString().trim() || null,
        grader_id: user.id,
        graded_at: new Date().toISOString(),
      })
      .eq('id', params.submissionId)
      .select('id, status, score, feedback, graded_at')
      .single()

    if (error || !graded) {
      console.error('[assessments/grade] DB error:', error)
      return NextResponse.json({ error: 'Failed to record grade' }, { status: 500 })
    }

    return NextResponse.json({ submission: graded })
  } catch (err) {
    console.error('[assessments/grade] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
