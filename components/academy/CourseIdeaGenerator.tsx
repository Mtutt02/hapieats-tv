'use client'

import { useState } from 'react'
import type { AiCourseIdea, CourseLevel } from '@/lib/academy/types'

const LEVELS: { value: CourseLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'professional', label: 'Professional' },
]

interface Props {
  onUse?: (idea: AiCourseIdea) => void
}

function SparklesIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5 10.1 7.6 12 3z" />
      <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </svg>
  )
}

function Shimmer() {
  return (
    <div className="mt-6 animate-pulse space-y-4">
      <div className="h-6 w-2/3 rounded bg-zinc-800" />
      <div className="h-4 w-full rounded bg-zinc-800" />
      <div className="h-4 w-5/6 rounded bg-zinc-800" />
      <div className="space-y-3 pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-zinc-800 p-3">
            <div className="h-4 w-1/3 rounded bg-zinc-800" />
            <div className="mt-3 h-3 w-2/3 rounded bg-zinc-800/70" />
            <div className="mt-2 h-3 w-1/2 rounded bg-zinc-800/70" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CourseIdeaGenerator({ onUse }: Props) {
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState<CourseLevel>('beginner')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idea, setIdea] = useState<(AiCourseIdea & { note?: string }) | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/academy/ai-course-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() || undefined, level }),
      })
      if (res.status === 401) {
        setError('Please sign in to generate course ideas.')
        setIdea(null)
        return
      }
      if (!res.ok) {
        setError('Could not generate an idea. Please try again.')
        setIdea(null)
        return
      }
      const data = await res.json()
      if (data?.idea) {
        setIdea(data.idea)
      } else {
        setError('No idea was returned. Please try again.')
        setIdea(null)
      }
    } catch {
      setError('Network error. Please try again.')
      setIdea(null)
    } finally {
      setLoading(false)
    }
  }

  const totalLessons = idea
    ? idea.sections.reduce((n, s) => n + s.lessons.length, 0)
    : 0

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
          <SparklesIcon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            I don&apos;t know what to teach
          </h2>
          <p className="text-sm text-zinc-400">
            Describe a topic (or leave it blank) and let AI draft a full course outline.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loading) generate()
          }}
          placeholder="e.g. sourdough for beginners, weeknight Thai, knife skills…"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as CourseLevel)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        >
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SparklesIcon className="h-4 w-4" />
        {loading ? 'Generating…' : 'Generate ideas'}
      </button>

      {error ? (
        <div className="mt-5 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? <Shimmer /> : null}

      {!loading && idea ? (
        <div className="mt-6">
          {idea.note ? (
            <div className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
              {idea.note}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-400">
              {idea.category.replace(/-/g, ' ')}
            </span>
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium capitalize text-zinc-300">
              {idea.level}
            </span>
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
              {idea.estimatedMinutes} min · {idea.sections.length} sections · {totalLessons} lessons
            </span>
          </div>

          <h3 className="mt-3 text-xl font-semibold text-zinc-100">{idea.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{idea.description}</p>

          <div className="mt-5 space-y-3">
            {idea.sections.map((section, si) => (
              <div key={si} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-emerald-500/10 text-xs font-semibold text-emerald-400">
                    {si + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-zinc-200">{section.title}</h4>
                </div>
                <ul className="mt-3 space-y-2 pl-8">
                  {section.lessons.map((lesson, li) => (
                    <li key={li} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-zinc-600" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">{lesson.title}</span>
                          {lesson.hasRecipe ? (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                              Recipe
                            </span>
                          ) : null}
                        </div>
                        {lesson.summary ? (
                          <p className="text-xs text-zinc-500">{lesson.summary}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-60"
            >
              <SparklesIcon className="h-4 w-4" />
              Regenerate
            </button>
            {onUse ? (
              <button
                type="button"
                onClick={() => onUse(idea)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                Use this outline
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && !idea && !error ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          Your generated course outline will appear here.
        </div>
      ) : null}
    </div>
  )
}
