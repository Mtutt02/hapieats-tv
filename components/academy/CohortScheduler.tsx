'use client'

import { useState, useCallback } from 'react'
import { CalendarPlus, Radio, Loader2 } from 'lucide-react'

interface CreatedCohort {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  capacity: number | null
  live_stream_id: string | null
  status: string
}

interface Props {
  courseId: string
  /** Called after a cohort is successfully created (e.g. to refresh a list). */
  onCreated?: (cohort: CreatedCohort) => void
}

// Local datetime (yyyy-MM-ddThh:mm) → ISO string for the API.
function toIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export default function CohortScheduler({ courseId, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [capacity, setCapacity] = useState('')
  const [createStream, setCreateStream] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const t = title.trim()
    if (t.length < 3) { setError('Give your class a title (at least 3 characters).'); return }
    const startIso = toIso(startsAt)
    if (!startIso) { setError('Pick a start date and time.'); return }
    const endIso = endsAt ? toIso(endsAt) : null
    if (endsAt && !endIso) { setError('That end time looks invalid.'); return }

    let cap: number | null = null
    if (capacity.trim()) {
      const n = parseInt(capacity, 10)
      if (isNaN(n) || n < 1) { setError('Capacity must be a whole number of 1 or more.'); return }
      cap = n
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/academy/cohorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          title: t,
          starts_at: startIso,
          ends_at: endIso,
          capacity: cap,
          create_stream: createStream,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not schedule this cohort.')
        return
      }
      setSuccess(`"${data.cohort.title}" scheduled.`)
      setTitle(''); setStartsAt(''); setEndsAt(''); setCapacity('')
      onCreated?.(data.cohort as CreatedCohort)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [title, startsAt, endsAt, capacity, createStream, courseId, onCreated])

  const inputCls =
    'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/60'

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-2">
        <CalendarPlus className="h-4 w-4 text-orange-400" />
        <h3 className="text-sm font-semibold text-white">Schedule a live cohort</h3>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value.slice(0, 120))}
          placeholder="Sunday Sourdough Cook-Along"
          className={inputCls}
          maxLength={120}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Starts</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={e => setStartsAt(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Ends (optional)</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={e => setEndsAt(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Capacity (optional)</label>
        <input
          type="number"
          min={1}
          value={capacity}
          onChange={e => setCapacity(e.target.value)}
          placeholder="No limit"
          className={inputCls}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={createStream}
          onChange={e => setCreateStream(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-orange-500"
        />
        <Radio className="h-3.5 w-3.5 text-orange-400" />
        Create a live stream for this cohort
      </label>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-emerald-400">{success}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
        {submitting ? 'Scheduling…' : 'Schedule cohort'}
      </button>
    </form>
  )
}
