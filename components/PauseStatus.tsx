'use client'

import { useEffect, useState } from 'react'

export const PAYMENTS_PAUSED_LINE = 'Purchases are paused for a short maintenance. Free videos still play.'
export const PAYOUTS_PAUSED_LINE = 'Creator payouts are paused for a short maintenance. Your earnings are safe.'

type Status = { paymentsPaused: boolean; payoutsPaused: boolean }
const NORMAL: Status = { paymentsPaused: false, payoutsPaused: false }

let cached: Status | null = null
let inflight: Promise<Status> | null = null

function load(): Promise<Status> {
  if (cached) return Promise.resolve(cached)
  inflight ??= fetch('/api/payments/status', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : NORMAL))
    .then(j => (cached = { paymentsPaused: !!j.paymentsPaused, payoutsPaused: !!j.payoutsPaused }))
    .catch(() => NORMAL) // can't tell: show normal UI, the server still enforces the pause
    .finally(() => { inflight = null })
  return inflight
}

/** Whether the safety pause is on. Starts "not paused" and corrects itself once loaded. */
export function usePauseStatus(): Status {
  const [status, setStatus] = useState<Status>(cached ?? NORMAL)
  useEffect(() => {
    let live = true
    load().then(s => { if (live) setStatus(s) })
    return () => { live = false }
  }, [])
  return status
}

/** The plain one-line notice. Renders nothing when the relevant pause is off. */
export function PausedNote({ kind = 'payments', className = '' }: { kind?: 'payments' | 'payouts'; className?: string }) {
  const { paymentsPaused, payoutsPaused } = usePauseStatus()
  const on = kind === 'payments' ? paymentsPaused : payoutsPaused
  if (!on) return null
  return (
    <p role="status" className={`text-sm text-amber-500 ${className}`}>
      {kind === 'payments' ? PAYMENTS_PAUSED_LINE : PAYOUTS_PAUSED_LINE}
    </p>
  )
}

/** Sitewide strip, shown only while purchases are paused. */
export function PauseBanner() {
  const { paymentsPaused } = usePauseStatus()
  if (!paymentsPaused) return null
  return (
    <div role="status" className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-500">
      {PAYMENTS_PAUSED_LINE}
    </div>
  )
}
