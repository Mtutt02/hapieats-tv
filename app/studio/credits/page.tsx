'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface CreditBalance {
  giftBalance: number
  loanBalance: number
  loanRepaid: number
  totalAvailable: number
  updatedAt: string | null
  ledger: LedgerEntry[]
}

interface LedgerEntry {
  id: string
  entry_type: string
  amount: number
  gift_balance_after: number
  loan_balance_after: number
  reference_type: string
  reference_id: string
  notes: string
  created_at: string
}

interface CreditRequest {
  id: string
  type: 'gift' | 'loan'
  amount: number
  reason: string
  status: 'pending' | 'approved' | 'denied'
  review_notes: string | null
  reviewed_at: string | null
  created_at: string
}

const ENTRY_LABELS: Record<string, string> = {
  grant_gift:           '🎁 Gift received',
  grant_loan:           '💸 Loan issued',
  spend_gift:           '🛍️ Gift credits used',
  spend_loan:           '🛍️ Loan credits used',
  repay_loan_earnings:  '✅ Loan repaid (earnings)',
  repay_loan_manual:    '✅ Loan repaid (Stripe)',
  expire_gift:          '⏳ Gift expired',
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Request Credits Form ───────────────────────────────────────────────────────
// Loan-only — repaid via Stripe auto-withdrawal or deducted from creator earnings
function RequestCreditsSection({ onSubmitted }: { onSubmitted: () => void }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount)
    if (!n || n <= 0 || n > 500) {
      setResult({ ok: false, msg: 'Amount must be between $0.01 and $500' })
      return
    }
    if (reason.trim().length < 20) {
      setResult({ ok: false, msg: 'Please provide at least 20 characters explaining your request' })
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const r = await fetch('/api/credits/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'loan', amount: n, reason: reason.trim() }),
      })
      const j = await r.json()
      if (!r.ok) {
        setResult({ ok: false, msg: j.error ?? 'Failed to submit' })
      } else {
        setResult({ ok: true, msg: '✅ Your request has been submitted. Our team will review it within 1–2 business days.' })
        setAmount('')
        setReason('')
        setOpen(false)
        onSubmitted()
      }
    } catch {
      setResult({ ok: false, msg: 'Network error — please try again' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
      >
        <div>
          <div className="font-semibold text-sm">Request Credits</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Apply for credit access — repaid via Stripe or auto-deducted from creator earnings
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 border-t border-border space-y-4 pt-4">
          {/* Repayment info */}
          <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-300 space-y-1">
            <p className="font-semibold">💸 Credit Loan</p>
            <p className="text-muted-foreground">Repaid automatically from your creator earnings, or via Stripe withdrawal. Your credits remain active until repaid.</p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Amount (max $500)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number" min="1" max="500" step="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-7 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Reason for Request
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Tell us what you'd like to access — e.g. I want to enroll in a cooking class…"
              minLength={20}
              maxLength={500}
              rows={3}
              required
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{reason.length}/500 · minimum 20 characters</p>
          </div>

          {result && (
            <div className={`p-3 rounded-xl text-sm ${
              result.ok
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {result.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl transition disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function CreditsPageInner() {
  const searchParams = useSearchParams()
  const repaidSuccess = searchParams.get('repaid') === 'true'

  const [data, setData] = useState<CreditBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [repaying, setRepaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<CreditRequest[]>([])
  const [reqKey, setReqKey] = useState(0)

  useEffect(() => {
    fetch('/api/credits/balance')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Failed to load credits'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/credits/request')
      .then(r => r.json())
      .then(j => setRequests(j.requests ?? []))
      .catch(() => {})
  }, [reqKey])

  async function handleRepay() {
    setRepaying(true)
    setError(null)
    try {
      const res = await fetch('/api/credits/repay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          successUrl: `${window.location.origin}/studio/credits?repaid=true`,
          cancelUrl: `${window.location.origin}/studio/credits`,
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'Could not start repayment')
      else if (json.url) window.location.href = json.url
    } catch {
      setError('Failed to start repayment')
    } finally {
      setRepaying(false)
    }
  }

  const statusBadge = (s: string) => {
    if (s === 'pending')  return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
    if (s === 'approved') return 'bg-green-500/10 text-green-400 border border-green-500/20'
    return 'bg-red-500/10 text-red-400 border border-red-500/20'
  }

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold">My Credits</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Platform credits can be used to purchase videos, Flavor Points, and more.
          </p>
        </div>

        {repaidSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-medium text-sm">
            ✅ Loan repayment successful — your balance has been updated.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-16">Loading your balance…</div>
        ) : !data ? null : (
          <>
            {/* Balance cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="rounded-2xl bg-card border border-border p-5">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Credit Balance</div>
                <div className="text-3xl font-black text-white">${data.totalAvailable.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">Available to spend</div>
              </div>
              <div className="rounded-2xl bg-card border border-border p-5">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Outstanding Loan</div>
                <div className={`text-3xl font-black ${data.loanBalance > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                  ${data.loanBalance.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.loanBalance > 0
                    ? `$${data.loanRepaid.toFixed(2)} repaid · auto-deducted from earnings`
                    : 'No outstanding balance'}
                </div>
              </div>
            </div>

            {/* Loan repayment CTA */}
            {data.loanBalance > 0 && (
              <div className="mb-8 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="font-semibold text-amber-300">Outstanding: ${data.loanBalance.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                      <p>✦ <span className="text-foreground font-medium">Auto-deducted</span> from creator earnings when you cash out</p>
                      <p>✦ Or repay now via <span className="text-foreground font-medium">Stripe withdrawal</span></p>
                    </div>
                  </div>
                  <button
                    onClick={handleRepay}
                    disabled={repaying}
                    className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition disabled:opacity-50 whitespace-nowrap"
                  >
                    {repaying ? 'Redirecting…' : `Pay via Stripe`}
                  </button>
                </div>
              </div>
            )}

            {/* Request Credits (collapsible) */}
            <RequestCreditsSection onSubmitted={() => setReqKey(k => k + 1)} />

            {/* Past credit requests */}
            {requests.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold mb-4">My Credit Requests</h2>
                <div className="space-y-2">
                  {requests.map(req => (
                    <div key={req.id} className="rounded-xl bg-card border border-border p-4 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              req.type === 'gift'
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {req.type === 'gift' ? '🎁 Gift' : '💸 Loan'}
                            </span>
                            <span className="font-bold">${parseFloat(String(req.amount)).toFixed(2)}</span>
                          </div>
                          <p className="text-muted-foreground text-xs line-clamp-2">{req.reason}</p>
                          {req.review_notes && (
                            <p className="text-xs mt-1 text-white/60">Admin note: {req.review_notes}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(req.status)}`}>
                            {req.status}
                          </span>
                          <div className="text-xs text-muted-foreground mt-1 whitespace-nowrap">{fmtDate(req.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction history */}
            <div>
              <h2 className="text-lg font-bold mb-4">Transaction History</h2>
              {data.ledger.length === 0 ? (
                <div className="text-muted-foreground text-sm py-8 text-center border border-dashed border-border rounded-xl">
                  No transactions yet. Credits will appear here once issued.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.ledger.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between p-4 rounded-xl bg-card border border-border text-sm"
                    >
                      <div>
                        <div className="font-medium">{ENTRY_LABELS[entry.entry_type] ?? entry.entry_type}</div>
                        {entry.notes && (
                          <div className="text-muted-foreground text-xs mt-0.5">{entry.notes}</div>
                        )}
                        <div className="text-muted-foreground text-xs mt-1">{fmtDate(entry.created_at)}</div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className={`font-bold ${
                          entry.entry_type.startsWith('spend') || entry.entry_type.startsWith('expire') || entry.entry_type.startsWith('repay')
                            ? 'text-red-400'
                            : 'text-green-400'
                        }`}>
                          {entry.entry_type.startsWith('grant') ? '+' : '-'}${entry.amount.toFixed(2)}
                        </div>
                        <div className="text-muted-foreground text-xs mt-0.5">
                          Balance: ${(entry.gift_balance_after + entry.loan_balance_after).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </AppShell>
  )
}

export default function CreditsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-muted-foreground text-sm">Loading…</div>}>
      <CreditsPageInner />
    </Suspense>
  )
}
