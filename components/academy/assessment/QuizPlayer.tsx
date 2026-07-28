'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

export interface QuizQuestion {
  q: string
  options: string[]
}

interface QuizPlayerProps {
  assessmentId: string
  title: string
  instructions?: string | null
  questions: QuizQuestion[]
  passThreshold: number
  onResult?: (result: { status: 'passed' | 'failed'; score: number }) => void
}

// Renders a multiple-choice quiz and submits answers for objective auto-scoring.
// The server compares against the hidden correctIndex — this component never
// sees the answer key.
export default function QuizPlayer({
  assessmentId,
  title,
  instructions,
  questions,
  passThreshold,
  onResult,
}: QuizPlayerProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ status: 'passed' | 'failed'; score: number } | null>(null)

  const allAnswered = questions.every((_, i) => answers[i] !== undefined)

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload = questions.map((_, i) => (answers[i] === undefined ? -1 : answers[i]))
      const res = await fetch(`/api/academy/assessments/${assessmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit quiz')
      const r = { status: data.submission.status as 'passed' | 'failed', score: data.submission.score as number }
      setResult(r)
      onResult?.(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    const passed = result.status === 'passed'
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
        {passed ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        ) : (
          <XCircle className="mx-auto h-12 w-12 text-neutral-500" />
        )}
        <h3 className="mt-3 text-xl font-bold text-neutral-900">
          {passed ? 'Passed' : 'Not yet'}
        </h3>
        <p className="mt-1 text-neutral-600">
          You scored {result.score}% (pass mark {passThreshold}%).
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <h3 className="text-xl font-bold text-neutral-900">{title}</h3>
      {instructions ? <p className="mt-1 text-sm text-neutral-600">{instructions}</p> : null}
      <p className="mt-1 text-xs text-neutral-500">Pass mark: {passThreshold}%</p>

      <div className="mt-5 space-y-6">
        {questions.map((question, qi) => (
          <div key={qi}>
            <p className="font-medium text-neutral-900">
              {qi + 1}. {question.q}
            </p>
            <div className="mt-2 space-y-2">
              {question.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    answers[qi] === oi
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${qi}`}
                    checked={answers[qi] === oi}
                    onChange={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                    className="accent-orange-600"
                  />
                  <span className="text-neutral-800">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <button
        onClick={submit}
        disabled={submitting || !allAnswered}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Submit Quiz
      </button>
      {!allAnswered ? (
        <p className="mt-2 text-xs text-neutral-500">Answer every question to submit.</p>
      ) : null}
    </div>
  )
}
