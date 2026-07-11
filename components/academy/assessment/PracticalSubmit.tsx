'use client'

import { useState } from 'react'
import { Loader2, Video, CheckCircle2 } from 'lucide-react'

export interface SubmittableVideo {
  id: string
  title: string
  thumbnailUrl?: string | null
}

interface PracticalSubmitProps {
  assessmentId: string
  title: string
  instructions?: string | null
  // Existing videos the student can submit (e.g. their uploaded cook-along videos).
  videos: SubmittableVideo[]
  onSubmitted?: () => void
}

// Practical submissions are HUMAN-graded. This component only records which
// video the student is submitting; an instructor grades it later in the queue.
export default function PracticalSubmit({
  assessmentId,
  title,
  instructions,
  videos,
  onSubmitted,
}: PracticalSubmitProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/academy/assessments/${assessmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: selected }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit')
      setDone(true)
      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h3 className="mt-3 text-xl font-bold text-neutral-900">Submitted for review</h3>
        <p className="mt-1 text-neutral-600">
          Your instructor will grade this practical and share feedback.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <h3 className="text-xl font-bold text-neutral-900">{title}</h3>
      {instructions ? <p className="mt-1 text-sm text-neutral-600">{instructions}</p> : null}
      <p className="mt-2 text-xs font-medium text-orange-600">
        Graded by your instructor — pick a video that shows your work.
      </p>

      {videos.length === 0 ? (
        <p className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">
          Upload a video first, then submit it here for grading.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {videos.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelected(v.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm ${
                selected === v.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <span className="flex h-12 w-16 flex-none items-center justify-center overflow-hidden rounded bg-neutral-100">
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Video className="h-5 w-5 text-neutral-400" />
                )}
              </span>
              <span className="line-clamp-2 font-medium text-neutral-800">{v.title}</span>
            </button>
          ))}
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <button
        onClick={submit}
        disabled={submitting || !selected}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Submit for Grading
      </button>
    </div>
  )
}
