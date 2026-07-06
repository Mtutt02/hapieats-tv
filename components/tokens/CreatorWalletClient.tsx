'use client'

import { useState } from 'react'
import {
  Wallet, TrendingUp, Flame, Target, Zap,
  DollarSign, Clock, CheckCircle2, AlertCircle, Lock,
  ShieldCheck, Coins, Send,
} from 'lucide-react'
import Link from 'next/link'

interface CreatorWallet {
  creator_id: string
  tokens_received: number
  pending_cents: number
  redeemable_cents: number
  lifetime_earnings_cents: number
  monthly_earnings: Record<string, Record<string, number>>
  payout_status: string
  last_payout_at: string | null
  last_payout_cents: number
}

interface Streak {
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
  total_posts: number
  total_streams: number
  streak_7_claimed: boolean
  streak_30_claimed: boolean
  streak_90_claimed: boolean
}

interface Props {
  wallet: CreatorWallet
  streak: Streak | null
  recentGifts: any[]
  activeGoals: any[]
  displayName: string
  monetizationStatus: 'locked' | 'pending_review' | 'unlocked'
  lifetimePurchased: number
  autoUnlockThreshold: number
  pendingRequest: { id: string; status: string; admin_note: string | null; created_at: string } | null
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const STREAK_MILESTONES = [
  { days: 7,  bonus: 50,   label: '7-Day Streak',  emoji: '🔥', key: 'streak_7_claimed'  },
  { days: 30, bonus: 250,  label: '30-Day Streak', emoji: '⚡', key: 'streak_30_claimed' },
  { days: 90, bonus: 1000, label: '90-Day Streak', emoji: '👑', key: 'streak_90_claimed' },
]

// ── Monetization gate component ────────────────────────────────────────────
function MonetizationGate({
  status,
  lifetimePurchased,
  threshold,
  pendingRequest,
  onRequestSubmitted,
}: {
  status: 'locked' | 'pending_review'
  lifetimePurchased: number
  threshold: number
  pendingRequest: Props['pendingRequest']
  onRequestSubmitted: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const tokensNeeded = Math.max(0, threshold - lifetimePurchased)
  const pct = Math.min(100, Math.round((lifetimePurchased / threshold) * 100))
  const isPending = status === 'pending_review' || !!pendingRequest

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/monetization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Submission failed')
      setSubmitted(true)
      setShowForm(false)
      onRequestSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (isPending || submitted) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="font-bold text-yellow-400">Review Pending</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your monetization request is under review. We'll notify you once approved — usually within 1–3 business days.
            </p>
            {pendingRequest?.admin_note && (
              <div className="mt-3 px-3 py-2 bg-muted/50 rounded-xl text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Admin note:</span> {pendingRequest.admin_note}
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Earnings accumulate while you wait — they'll be available to cash out once approved.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden mb-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Earnings Locked</h2>
            <p className="text-xs text-muted-foreground">Unlock to start cashing out your Hapi Token earnings</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <p className="text-sm text-muted-foreground mb-6">
          Your earnings are accumulating! To protect the platform, payouts require a one-time unlock. Choose one of the two paths below:
        </p>

        {/* Path 1: Auto-unlock via token purchase */}
        <div className={`border rounded-xl p-5 mb-4 ${lifetimePurchased >= threshold ? 'border-green-500/40 bg-green-500/5' : 'border-border'}`}>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Coins className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm">Purchase {threshold.toLocaleString()} Hapi Tokens</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Instantly auto-unlocks when your lifetime token purchases reach {threshold} tokens — no wait required.
              </div>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden mb-1.5">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mb-3">
            <span>{lifetimePurchased.toLocaleString()} / {threshold.toLocaleString()} tokens purchased</span>
            <span>{pct}%</span>
          </div>
          {lifetimePurchased >= threshold ? (
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" /> Threshold reached — processing unlock…
            </div>
          ) : (
            <Link
              href="/tokens"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Zap className="h-4 w-4" />
              Buy Tokens ({tokensNeeded.toLocaleString()} more needed)
            </Link>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Path 2: Manual review request */}
        <div className="border border-border rounded-xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Send className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="font-semibold text-sm">Request Manual Review</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Tell us about your content and we'll review your account. Usually 1–3 business days.
              </div>
            </div>
          </div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            >
              Request Review
            </button>
          ) : (
            <form onSubmit={submitRequest} className="space-y-3 mt-2">
              <textarea
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Tell us about your content, how long you've been creating, and why you'd like monetization access…"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />{error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          Earnings accumulate while locked. Once unlocked, your full balance is immediately available to cash out.
        </p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CreatorWalletClient({
  wallet, streak, recentGifts, activeGoals, displayName,
  monetizationStatus: initialStatus, lifetimePurchased, autoUnlockThreshold, pendingRequest,
}: Props) {
  const [monetizationStatus, setMonetizationStatus] = useState(initialStatus)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [claimingMilestone, setClaimingMilestone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const isUnlocked = monetizationStatus === 'unlocked'

  const currentMonth = new Date().toISOString().slice(0, 7)
  const thisMonthEarnings = wallet.monthly_earnings?.[currentMonth] ?? { gifts: 0, challenges: 0, goals: 0, circle: 0 }
  const thisMonthTotal = Object.values(thisMonthEarnings).reduce((a: number, b: number) => a + b, 0)

  async function requestPayout() {
    if (wallet.redeemable_cents < 100 || !isUnlocked) return
    setPayoutLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: wallet.redeemable_cents }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payout request failed')
      setSuccessMsg(`Payout of ${formatCents(data.payout_requested_cents)} requested! We'll process it within 3–5 business days.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payout failed')
    } finally {
      setPayoutLoading(false)
    }
  }

  async function claimStreak(milestone: string) {
    setClaimingMilestone(milestone)
    setError(null)
    try {
      const res = await fetch('/api/creator/streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Claim failed')
      setSuccessMsg(`🎉 ${data.tokens_awarded} Hapi Tokens awarded for your ${milestone}-day streak!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed')
    } finally {
      setClaimingMilestone(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-8">

      {/* Header */}
      <div className="mb-1 flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          Creator Wallet
        </h1>
        {isUnlocked ? (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
            <ShieldCheck className="h-3 w-3" /> Monetized
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            <Lock className="h-3 w-3" /> {monetizationStatus === 'pending_review' ? 'Under Review' : 'Locked'}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-sm mb-6">Welcome back, {displayName}</p>

      {/* Alerts */}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{successMsg}
        </div>
      )}

      {/* Gate — shown when not yet unlocked */}
      {!isUnlocked && (
        <MonetizationGate
          status={monetizationStatus as 'locked' | 'pending_review'}
          lifetimePurchased={lifetimePurchased}
          threshold={autoUnlockThreshold}
          pendingRequest={pendingRequest}
          onRequestSubmitted={() => setMonetizationStatus('pending_review')}
        />
      )}

      {/* Earnings cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Redeemable',   value: formatCents(wallet.redeemable_cents),         icon: DollarSign, color: 'text-green-400'  },
          { label: 'This Month',   value: formatCents(thisMonthTotal),                  icon: TrendingUp, color: 'text-blue-400'   },
          { label: 'Lifetime',     value: formatCents(wallet.lifetime_earnings_cents),   icon: Wallet,     color: 'text-primary'    },
          { label: 'Tokens Recv',  value: wallet.tokens_received.toLocaleString(),       icon: Zap,        color: 'text-yellow-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`bg-card border border-border rounded-xl p-4 ${!isUnlocked ? 'opacity-60' : ''}`}>
            <div className={`${color} mb-2`}><Icon className="h-4 w-4" /></div>
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Monthly breakdown */}
      {isUnlocked && thisMonthTotal > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-8">
          <h2 className="font-semibold text-sm mb-4">This Month — Breakdown</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Live Gifts',  value: thisMonthEarnings.gifts      ?? 0, emoji: '🎁' },
              { label: 'Challenges',  value: thisMonthEarnings.challenges  ?? 0, emoji: '🏆' },
              { label: 'Goals',       value: thisMonthEarnings.goals       ?? 0, emoji: '🎯' },
              { label: 'Circle Pool', value: thisMonthEarnings.circle      ?? 0, emoji: '🌀' },
            ].map(({ label, value, emoji }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-3 text-center">
                <div className="text-xl mb-1">{emoji}</div>
                <div className="text-sm font-semibold">{formatCents(value)}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payout */}
      <div className={`bg-card border border-border rounded-xl p-5 mb-8 ${!isUnlocked ? 'opacity-60 pointer-events-none select-none' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              Request Payout
              {!isUnlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {!isUnlocked
                ? 'Unlock monetization above to cash out your earnings.'
                : wallet.payout_status === 'pending'
                  ? 'A payout is currently being processed.'
                  : `${formatCents(wallet.redeemable_cents)} available to cash out.`}
            </p>
            {wallet.last_payout_at && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last payout: {formatCents(wallet.last_payout_cents ?? 0)} on{' '}
                {new Date(wallet.last_payout_at).toLocaleDateString()}
              </p>
            )}
          </div>
          {isUnlocked && wallet.payout_status !== 'pending' && (
            <button
              onClick={requestPayout}
              disabled={payoutLoading || wallet.redeemable_cents < 100}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {payoutLoading ? 'Requesting…' : `Cash Out ${formatCents(wallet.redeemable_cents)}`}
            </button>
          )}
          {isUnlocked && wallet.payout_status === 'pending' && (
            <span className="flex items-center gap-1.5 text-sm text-yellow-400 font-medium shrink-0">
              <Clock className="h-4 w-4" /> Pending
            </span>
          )}
        </div>
        {isUnlocked && (
          <p className="mt-3 text-xs text-muted-foreground">
            Requires Stripe Connect. <Link href="/dashboard/monetize" className="text-primary hover:underline">Set up payouts →</Link>
          </p>
        )}
      </div>

      {/* Streak bonuses */}
      {streak && (
        <div className="bg-card border border-border rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" />
              Creator Streak
            </h2>
            <div className="text-right">
              <div className="text-2xl font-black text-primary">{streak.current_streak}</div>
              <div className="text-xs text-muted-foreground">day streak</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {STREAK_MILESTONES.map(({ days, bonus, label, emoji, key }) => {
              const claimed = streak[key as keyof Streak] as boolean
              const eligible = streak.current_streak >= days
              return (
                <div key={days} className={`border rounded-xl p-3 text-center ${claimed ? 'border-green-500/30 bg-green-500/5' : eligible ? 'border-primary/40' : 'border-border opacity-50'}`}>
                  <div className="text-2xl mb-1">{emoji}</div>
                  <div className="text-xs font-semibold">{label}</div>
                  <div className="text-xs text-primary font-mono mt-1">+{bonus} tokens</div>
                  {claimed ? (
                    <div className="mt-2 text-xs text-green-400 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Claimed
                    </div>
                  ) : eligible ? (
                    <button
                      onClick={() => claimStreak(days.toString())}
                      disabled={claimingMilestone === days.toString()}
                      className="mt-2 w-full text-xs bg-primary text-primary-foreground rounded-lg py-1 font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      {claimingMilestone === days.toString() ? '…' : 'Claim!'}
                    </button>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">{days - streak.current_streak} days to go</div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><div className="text-sm font-bold">{streak.total_posts}</div><div className="text-xs text-muted-foreground">Posts</div></div>
            <div><div className="text-sm font-bold">{streak.total_streams}</div><div className="text-xs text-muted-foreground">Streams</div></div>
            <div><div className="text-sm font-bold">{streak.longest_streak}</div><div className="text-xs text-muted-foreground">Longest</div></div>
          </div>
        </div>
      )}

      {/* Recent gifts */}
      {recentGifts.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <span className="text-base">🎁</span> Recent Gifts
            </h2>
          </div>
          <div className="divide-y divide-border">
            {recentGifts.map((g: any) => (
              <div key={g.id} className="flex items-center gap-3 px-5 py-3">
                <div className="text-2xl">{g.gift?.emoji ?? '🎁'}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{g.gift?.name ?? 'Gift'}</div>
                  <div className="text-xs text-muted-foreground">
                    from @{g.sender?.username ?? 'fan'} · {new Date(g.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className={`text-sm font-semibold ${isUnlocked ? 'text-green-400' : 'text-muted-foreground'}`}>
                  +{formatCents(g.creator_earned_cents)}
                </div>
              </div>
            ))}
          </div>
          {!isUnlocked && (
            <div className="px-5 py-3 bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
              <Lock className="h-3 w-3" /> Earnings will be cashable once monetization is unlocked.
            </div>
          )}
        </div>
      )}

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Active Goals
            </h2>
            <Link href="/creator/goals" className="text-xs text-primary hover:underline">Manage →</Link>
          </div>
          <div className="divide-y divide-border">
            {activeGoals.map((goal: any) => {
              const pct = Math.min(100, Math.round((goal.current_tokens / goal.target_tokens) * 100))
              return (
                <div key={goal.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium truncate">{goal.title}</div>
                    <div className="text-xs text-muted-foreground ml-2 shrink-0">{pct}%</div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    {goal.current_tokens.toLocaleString()} / {goal.target_tokens.toLocaleString()} tokens
                    {goal.deadline && <> · Deadline: {new Date(goal.deadline).toLocaleDateString()}</>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/creator/goals" className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors">
          <Target className="h-4 w-4 text-primary" />
          <div><div className="text-sm font-semibold">My Goals</div><div className="text-xs text-muted-foreground">Fan-funded goals</div></div>
        </Link>
        <Link href="/challenges" className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors">
          <TrendingUp className="h-4 w-4 text-primary" />
          <div><div className="text-sm font-semibold">Challenges</div><div className="text-xs text-muted-foreground">Enter & compete</div></div>
        </Link>
      </div>
    </div>
  )
}
