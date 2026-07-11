import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface QuizQuestion {
  q: string
  options: string[]
  correctIndex: number
}

// POST — a student submits an assessment.
//   Quiz      → objectively auto-scored against config.correctIndex (NOT AI grading);
//               status passed/failed decided by pass_threshold.
//   Practical → stores { video_id }, status 'submitted', awaiting a human grade.
export async function POST(
  req: NextRequest,
  { params }: { params: { assessmentId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      answers?: number[]
      videoId?: string
    }

    const { data: assessment } = await supabase
      .from('assessments')
      .select('id, course_id, type, config, pass_threshold')
      .eq('id', params.assessmentId)
      .single()
    if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    // Enrollment gate — must be enrolled in the course (owner may self-test).
    const { data: course } = await supabase
      .from('courses')
      .select('id, creator_id')
      .eq('id', assessment.course_id)
      .single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    if (course.creator_id !== user.id) {
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', assessment.course_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!enrollment) {
        return NextResponse.json({ error: 'Enroll in this course before submitting' }, { status: 403 })
      }
    }

    if (assessment.type === 'quiz') {
      const questions: QuizQuestion[] = Array.isArray((assessment.config as { questions?: unknown })?.questions)
        ? (assessment.config as { questions: QuizQuestion[] }).questions
        : []
      if (questions.length === 0) {
        return NextResponse.json({ error: 'This quiz has no questions' }, { status: 400 })
      }
      const answers = Array.isArray(body.answers) ? body.answers.map((n) => Number(n)) : []

      let correct = 0
      questions.forEach((question, i) => {
        if (answers[i] === question.correctIndex) correct++
      })
      const score = Math.round((correct / questions.length) * 100)
      const status = score >= assessment.pass_threshold ? 'passed' : 'failed'

      const { data: submission, error } = await supabase
        .from('assessment_submissions')
        .insert({
          assessment_id: assessment.id,
          user_id: user.id,
          answers,
          status,
          score,
          graded_at: new Date().toISOString(),
        })
        .select('id, status, score')
        .single()

      if (error || !submission) {
        console.error('[assessments/submit quiz] DB error:', error)
        return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 })
      }
      return NextResponse.json({ submission })
    }

    // Practical — human-graded. Record the video and mark 'submitted'.
    const videoId = typeof body.videoId === 'string' ? body.videoId : ''
    if (!videoId) {
      return NextResponse.json({ error: 'A video submission is required' }, { status: 400 })
    }

    const { data: submission, error } = await supabase
      .from('assessment_submissions')
      .insert({
        assessment_id: assessment.id,
        user_id: user.id,
        video_id: videoId,
        status: 'submitted',
      })
      .select('id, status')
      .single()

    if (error || !submission) {
      console.error('[assessments/submit practical] DB error:', error)
      return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
    }
    return NextResponse.json({ submission })
  } catch (err) {
    console.error('[assessments/submit] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
