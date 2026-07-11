import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AssessmentType } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

interface QuizQuestion {
  q: string
  options: string[]
  correctIndex: number
}

// POST — course owner creates an assessment (quiz or practical) for a course/lesson.
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      courseId?: string
      lessonId?: string | null
      type?: string
      title?: string
      instructions?: string | null
      config?: Record<string, unknown>
      passThreshold?: number
    }

    const courseId = typeof body.courseId === 'string' ? body.courseId : ''
    if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }

    const type: AssessmentType = body.type === 'practical' ? 'practical' : 'quiz'

    // Owner check — only the course creator may create assessments on it.
    const { data: course } = await supabase
      .from('courses')
      .select('id, creator_id')
      .eq('id', courseId)
      .single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (course.creator_id !== user.id) {
      return NextResponse.json({ error: 'Only the course owner can create assessments' }, { status: 403 })
    }

    let config: Record<string, unknown> = {}
    if (type === 'quiz') {
      const rawQuestions = Array.isArray((body.config as { questions?: unknown })?.questions)
        ? ((body.config as { questions: unknown[] }).questions)
        : []
      const questions: QuizQuestion[] = []
      for (const raw of rawQuestions) {
        const r = raw as Partial<QuizQuestion>
        const q = typeof r.q === 'string' ? r.q.trim() : ''
        const options = Array.isArray(r.options)
          ? r.options.filter((o) => typeof o === 'string').map((o) => String(o))
          : []
        const correctIndex = Number(r.correctIndex)
        if (!q || options.length < 2) continue
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) continue
        questions.push({ q, options, correctIndex })
      }
      if (questions.length === 0) {
        return NextResponse.json({ error: 'A quiz needs at least one valid question' }, { status: 400 })
      }
      config = { questions }
    }

    let passThreshold = Number(body.passThreshold)
    if (!Number.isFinite(passThreshold)) passThreshold = 70
    passThreshold = Math.min(100, Math.max(0, Math.round(passThreshold)))

    const { data: assessment, error } = await supabase
      .from('assessments')
      .insert({
        course_id: courseId,
        lesson_id: typeof body.lessonId === 'string' ? body.lessonId : null,
        type,
        title,
        instructions: body.instructions?.toString().trim() || null,
        config,
        pass_threshold: passThreshold,
      })
      .select('id, type, title, pass_threshold')
      .single()

    if (error || !assessment) {
      console.error('[academy/assessments POST] DB error:', error)
      return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 })
    }

    return NextResponse.json({ assessment })
  } catch (err) {
    console.error('[academy/assessments POST] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// GET — list assessments for a course. Strips quiz answer keys for non-owners.
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const courseId = req.nextUrl.searchParams.get('courseId') ?? ''
    if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })

    const { data: { user } } = await supabase.auth.getUser()

    const { data: course } = await supabase
      .from('courses')
      .select('id, creator_id')
      .eq('id', courseId)
      .single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const isOwner = !!user && course.creator_id === user.id

    const { data: assessments, error } = await supabase
      .from('assessments')
      .select('id, course_id, lesson_id, type, title, instructions, config, pass_threshold, created_at')
      .eq('course_id', courseId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[academy/assessments GET] DB error:', error)
      return NextResponse.json({ error: 'Failed to load assessments' }, { status: 500 })
    }

    // Never leak correctIndex to students.
    const sanitized = (assessments ?? []).map((a) => {
      if (isOwner || a.type !== 'quiz') return a
      const questions = Array.isArray((a.config as { questions?: unknown })?.questions)
        ? (a.config as { questions: QuizQuestion[] }).questions.map((q) => ({ q: q.q, options: q.options }))
        : []
      return { ...a, config: { questions } }
    })

    return NextResponse.json({ assessments: sanitized })
  } catch (err) {
    console.error('[academy/assessments GET] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
