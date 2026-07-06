'use client'

/**
 * CreditGrantModal
 *
 * Admin/superadmin component to issue gift or loan credits to any user.
 * POST /api/admin/credits/grant
 *
 * Usage:
 *   <CreditGrantModal userId="..." userName="Jane" onGranted={() => reload()} />
 */

import { useState } from 'react'

interface Props {
  userId: string
  userName: string
  onGranted?: (result: { type: string; amount: number }) => void
  onClose?: () => void
}

export default function CreditGrantModal({ userId, userName, onGranted, onClose }: Props) {
  const [type, setType] = useState<'gift' | 'loan'>('gift')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      setError('Enter a valid amount greater than $0')
      return
    }
    if (numAmount > 10_000) {
      setError('Maximum single grant is $10,000')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type, amount: numAmount, notes: notes || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to issue credits')
      } else {
        setSuccess(`✅ $${numAmount.toFixed(2)} in ${type} credits issued to ${userName}`)
        setAmount('')
        setNotes('')
        onGranted?.({ type, amount: numAmount })
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold">Issue Credits</h2>
            <p className="text-sm text-muted-foreground mt-0.5">To: <span className="text-white font-medium">{userName}</span></p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-white text-xl leading-none transition"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Credit type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Credit Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['gift', 'loan'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2.5 rounded-xl font-semibold text-sm border transition ${
                    type === t
                      ? t === 'gift'
                        ? 'bg-green-500/20 border-green-500/50 text-green-300'
                        : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'border-white/10 text-muted-foreground hover:border-white/20'
                  }`}
                >
                  {t === 'gift' ? '🎁 Gift' : '💸 Loan'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {type === 'gift'
                ? 'Free credits — no repayment required. Creator earns $0 from credit-funded purchases.'
                : 'Loan credits — auto-repaid from creator cashouts or manual Stripe payment.'}
            </p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Amount (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-7 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50 transition"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Contest winner, onboarding bonus…"
              maxLength={200}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50 transition"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-black font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Issuing…' : `Issue $${parseFloat(amount || '0').toFixed(2)} in ${type} credits`}
          </button>
        </form>
      </div>
    </div>
  )
}
