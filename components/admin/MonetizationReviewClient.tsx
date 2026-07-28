'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Clock, ShieldCheck, Coins, AlertCircle, Lock } from 'lucide-react'

interface Request {
  id: string
  status: string
  request_note: string | null
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
  creator: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; created_at: string } | null
  wallet: { monetization_status: string; tokens_received: number; lifetime_earnings_cents: number } | null
  tokens: { lifetime_purchased: number; balance: number } | null
}

interface Props {
  pending: Request[]
  reviewed: Request[]
}

function formatCents(c: number) { return `$${(c / 100).toFixed(2)}` }

function RequestCard({ req, onReviewed }: { req: Request; onReviewed: (id: string, decision: string) => void }) {
  const [adminNote, setAdminNote] = useState('')
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function review(decision: 'approved' | 'denied') {
    setSubmitting(decision)
    setError(null)
    try {
      const res = await fetch('/api/admin/monetization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: req.id, decision, admin_note: adminNote.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Review failed')
      setDone(true)
      onReviewed(req.id, decision)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed')
    } finally {
      setSubmitting(null)
    }
  }

  if (done) return null

  const STATUS_BADGE: Record<string, string> = {
    pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    approved: 'bg-green-500/10 text-green-400 border-green-500/20',
    denied:   'bg-destructive/10 text-destructive border-destructive/20',
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-start gap-4 p-5">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {req.creator?.avatar_url
            ? <img src={req.creator.avatar_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-sm font-bold">{(req.creator?.display_name ?? '?')[0].toUpperCase()}</span>
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm">{req.creator?.display_name ?? 'Unknown'}</span>
            {req.creator?.username && <span className="text-xs text-muted-foreground">@{req.creator.username}</span>}
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_BADGE[req.status] ?? ''}`}>
              {req.status}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3 text-primary" />
              {(req.tokens?.lifetime_purchased ?? 0).toLocaleString()} tokens purchased
            </span>
            <span className="flex items-center gap-1">
              {req.wallet?.lifetime_earnings_cents
                ? <><CheckCircle2 className="h-3 w-3 text-green-400" />{formatCents(req.wallet.lifetime_earnings_cents)} earned</>
                : <><Lock className="h-3 w-3" />No earnings yet</>
              }
            </span>
            <span>Joined {new Date(req.creator?.created_at ?? '').toLocaleDateString()}</span>
            <span>Requested {new Date(req.created_at).toLocaleDateString()}</span>
          </div>

          {/* Creator note */}
          {req.request_note && (
            <div className="bg-muted/40 rounded-xl px-4 py-3 text-sm mb-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">Creator's message:</div>
              {req.request_note}
            </div>
          )}

          {/* Past admin note */}
          {req.admin_note && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-sm mb-3">
              <div className="text-xs font-medium text-primary mb-1">Admin note:</div>
              {req.admin_note}
            </div>
          )}

          {/* Review controls — only for pending */}
          {req.status === 'pending' && (
            <div className="space-y-2">
              <input
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="Optional note to creator (shown after decision)…"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />{error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => review('approved')}
                  disabled={!!submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-500 transition-colors disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting === 'approved' ? 'Approving…' : 'Approve'}
                </button>
                <button
                  onClick={() => review('denied')}
                  disabled={!!submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-xl text-sm font-semibold hover:bg-destructive/80 transition-colors disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  {submitting === 'denied' ? 'Denying…' : 'Deny'}
                </button>
              </div>
            </div>
          )}

          {/* Reviewed info */}
          {req.status !== 'pending' && req.reviewed_at && (
            <div className="text-xs text-muted-foreground">
              Reviewed {new Date(req.reviewed_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MonetizationReviewClient({ pending: initialPending, reviewed }: Props) {
  const [pending, setPending] = useState(initialPending)
  const [recentlyReviewed, setRecentlyReviewed] = useState<{ id: string; decision: string }[]>([])

  function handleReviewed(id: string, decision: string) {
    setPending(p => p.filter(r => r.id !== id))
    setRecentlyReviewed(r => [{ id, decision }, ...r])
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Monetization Requests
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review creator applications to unlock earnings and payouts.
        </p>
      </div>

      {/* Recently reviewed in this session */}
      {recentlyReviewed.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {recentlyReviewed.map(({ id, decision }) => (
            <div key={id} className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${decision === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-destructive/10 text-destructive'}`}>
              {decision === 'approved' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              Request {decision}
            </div>
          ))}
        </div>
      )}

      {/* Pending */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-400" />
          Pending Review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border border-border rounded-xl">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            No pending requests
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map(r => (
              <RequestCard key={r.id} req={r} onReviewed={handleReviewed} />
            ))}
          </div>
        )}
      </section>

      {/* Past decisions */}
      {reviewed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Past Decisions</h2>
          <div className="space-y-3">
            {reviewed.map(r => (
              <RequestCard key={r.id} req={r} onReviewed={handleReviewed} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
