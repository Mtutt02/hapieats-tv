'use client'

import { useState } from 'react'

interface ProgramEnrollButtonProps {
  programId: string
  isFree: boolean
}

/** Enroll CTA for a themed program page. Free → instant; paid → Stripe redirect. */
export default function ProgramEnrollButton({ programId, isFree }: ProgramEnrollButtonProps) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function enroll() {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/academy/programs/${programId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          successUrl: window.location.href,
          cancelUrl: window.location.href,
        }),
      })
      const data = await res.json()
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      if (res.ok && data.enrolled) {
        setMsg("You're enrolled!")
      } else {
        setMsg(data.error || 'Could not enroll')
      }
    } catch {
      setMsg('Could not enroll')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={enroll}
        disabled={loading}
        className="rounded-lg bg-[var(--brand-accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Working…' : isFree ? 'Enroll for free' : 'Enroll now'}
      </button>
      {msg && <p className="mt-2 text-sm text-slate-500">{msg}</p>}
    </div>
  )
}
