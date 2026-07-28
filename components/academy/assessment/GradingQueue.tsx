'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

// Lazy-load MuxPlayer (no SSR).
let MuxPlayer: React.ComponentType<Record<string, unknown>> | null = null

export interface PendingSubmission {
  id: string
  submitted_at: string
  student: string
  assessmentTitle: string
  courseTitle: string
  instructions: string | null
  muxPlaybackId: string | null
}

interface GradingQueueProps {
  submissions: PendingSubmission[]
}

export default function GradingQueue({ submissions }: GradingQueueProps) {
  const [muxLoaded, setMuxLoaded] = useState(false)

  useEffect(() => {
    import('@mux/mux-player-react').then((mod) => {
      MuxPlayer = mod.default as React.ComponentType<Record<string, unknown>>
      setMuxLoaded(true)
    })
  }, [])

  const [queue, setQueue] = useState(submissions)

  const onGraded = (id: string) => setQueue((q) => q.filter((s) => s.id !== id))

  if (queue.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center text-neutral-500">
        <p className="text-lg font-medium">No submissions awaiting grading</p>
        <p className="mt-1 text-sm">Practical submissions from your students will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {queue.map((sub) => (
        <GradeCard key={sub.id} sub={sub} muxLoaded={muxLoaded} onGraded={onGraded} />
      ))}
    </div>
  )
}

function GradeCard({
  sub,
  muxLoaded,
  onGraded,
}: {
  sub: PendingSubmission
  muxLoaded: boolean
  onGraded: (id: string) => void
}) {
  const [score, setScore] = useState<string>('')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState<'passed' | 'failed' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (status: 'passed' | 'failed') => {
    setSaving(status)
    setError(null)
    try {
      const res = await fetch(`/api/academy/assessments/submissions/${sub.id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          score: score === '' ? undefined : Number(score),
          feedback: feedback.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to grade')
      onGraded(sub.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="grid gap-0 md:grid-cols-2">
        <div className="bg-black">
          {muxLoaded && MuxPlayer && sub.muxPlaybackId ? (
            <MuxPlayer
              playbackId={sub.muxPlaybackId}
              streamType="on-demand"
              style={{ width: '100%', aspectRatio: '16 / 9' }}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-neutral-400">
              {sub.muxPlaybackId ? 'Loading video…' : 'No video attached'}
            </div>
          )}
        </div>

        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            {sub.courseTitle}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-900">{sub.assessmentTitle}</h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            Submitted by {sub.student} · {new Date(sub.submitted_at).toLocaleDateString()}
          </p>
          {sub.instructions ? (
            <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
              {sub.instructions}
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Score (0–100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Feedback</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Notes for the student…"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex gap-3">
              <button
                onClick={() => submit('passed')}
                disabled={saving !== null}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {saving === 'passed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Pass
              </button>
              <button
                onClick={() => submit('failed')}
                disabled={saving !== null}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-900 disabled:opacity-60"
              >
                {saving === 'failed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Fail
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
