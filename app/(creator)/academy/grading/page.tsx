import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import GradingQueue, { type PendingSubmission } from '@/components/academy/assessment/GradingQueue'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Grading Queue — Academy',
  description: 'Human-graded practical submissions awaiting your review.',
}

export default async function GradingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/academy/grading')

  // Courses this instructor owns.
  const { data: courses } = await supabase
    .from('courses')
    .select('id, title')
    .eq('creator_id', user.id)

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]))
  const courseIds = Array.from(courseMap.keys())

  let pending: PendingSubmission[] = []

  if (courseIds.length > 0) {
    // Practical assessments across the owned courses.
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id, course_id, title, instructions')
      .eq('type', 'practical')
      .in('course_id', courseIds)

    const assessmentMap = new Map((assessments ?? []).map((a) => [a.id, a]))
    const assessmentIds = Array.from(assessmentMap.keys())

    if (assessmentIds.length > 0) {
      // Pending (awaiting human grade) submissions.
      const { data: submissions } = await supabase
        .from('assessment_submissions')
        .select('id, assessment_id, user_id, video_id, submitted_at')
        .eq('status', 'submitted')
        .in('assessment_id', assessmentIds)
        .order('submitted_at', { ascending: true })

      const rows = submissions ?? []
      const studentIds = Array.from(new Set(rows.map((r) => r.user_id)))
      const videoIds = Array.from(new Set(rows.map((r) => r.video_id).filter(Boolean))) as string[]

      const [{ data: profiles }, { data: videos }] = await Promise.all([
        studentIds.length
          ? supabase.from('profiles').select('id, display_name, username').in('id', studentIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string | null; username: string | null }[] }),
        videoIds.length
          ? supabase.from('videos').select('id, mux_playback_id').in('id', videoIds)
          : Promise.resolve({ data: [] as { id: string; mux_playback_id: string | null }[] }),
      ])

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
      const videoMap = new Map((videos ?? []).map((v) => [v.id, v.mux_playback_id]))

      pending = rows.map((r) => {
        const a = assessmentMap.get(r.assessment_id)
        const p = profileMap.get(r.user_id)
        return {
          id: r.id,
          submitted_at: r.submitted_at,
          student: p?.display_name || p?.username || 'Student',
          assessmentTitle: a?.title ?? 'Practical Assessment',
          courseTitle: (a && courseMap.get(a.course_id)) || 'Course',
          instructions: a?.instructions ?? null,
          muxPlaybackId: r.video_id ? (videoMap.get(r.video_id) ?? null) : null,
        }
      })
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900">Grading Queue</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Review and grade practical submissions. Quizzes are scored automatically — only
            practicals require your judgment.
          </p>
        </div>
        <GradingQueue submissions={pending} />
      </div>
    </AppShell>
  )
}
