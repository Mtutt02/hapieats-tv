'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Gift, Target, TrendingUp, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatViews } from '@/lib/utils'

/**
 * Goal data as `creator_goals` actually stores it.
 *
 * The page selects '*' from creator_goals, so these are the real column names.
 * This component previously read current_amount / target_amount / name — none
 * of which exist — so every goal rendered "NaN%" with a blank title, and
 * `remaining > 0` was false, which meant the Contribute button never appeared
 * at all. The props were typed `any[]`, so nothing caught it.
 */
export interface GoalData {
  id: string
  title: string
  description?: string | null
  target_tokens: number
  current_tokens: number
  reward_description?: string | null
  cover_image_url?: string | null
  status?: string | null
  deadline?: string | null
  created_at?: string
}

interface CreatorGoalThermometerProps {
  goals: GoalData[]
  creatorName: string
  /** Hide contribution controls when the viewer is the goal's owner. */
  isOwner?: boolean
}

const PRESETS = [50, 100, 500]

export default function CreatorGoalThermometer({
  goals,
  creatorName,
  isOwner = false,
}: CreatorGoalThermometerProps) {
  if (!goals || goals.length === 0) {
    return (
      <div className="rounded-3xl border border-foreground/5 bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-pink-400" />
          <h3 className="font-semibold text-lg">Goals &amp; Gifts</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {creatorName} hasn&apos;t set any goals yet. Gifts will show up here when they do!
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-foreground/5 bg-card/50 backdrop-blur-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-pink-400" />
        <h3 className="font-semibold text-lg">Goals &amp; Gifts</h3>
      </div>

      {goals
        .filter((g) => (g.status ?? 'active') !== 'cancelled')
        .map((goal) => (
          <GoalRow key={goal.id} goal={goal} isOwner={isOwner} />
        ))}
    </div>
  )
}

function GoalRow({ goal, isOwner }: { goal: GoalData; isOwner: boolean }) {
  const router = useRouter()

  // Track progress locally so a contribution updates the bar immediately.
  const [current, setCurrent] = useState(Number(goal.current_tokens) || 0)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<number>(PRESETS[0])
  const [customAmount, setCustomAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<React.ReactNode>(null)
  const [thanks, setThanks] = useState(false)

  const target = Math.max(1, Number(goal.target_tokens) || 1)
  const pct = Math.min(100, Math.max(0, Math.round((current / target) * 100)))
  const remaining = Math.max(0, target - current)
  const complete = remaining === 0 || (goal.status ?? 'active') === 'completed'

  const chosen = customAmount.trim() ? Number(customAmount) : amount
  const validAmount = Number.isFinite(chosen) && chosen >= 1 && chosen <= 100000

  const contribute = async () => {
    if (!validAmount || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/goals/${goal.id}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: chosen }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 401) {
        setError(
          <>
            <Link href="/login" className="underline">Sign in</Link> to contribute.
          </>,
        )
        return
      }
      if (res.status === 402) {
        setError(
          <>
            Not enough tokens.{' '}
            <Link href="/tokens" className="underline">Get more</Link>.
          </>,
        )
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Could not contribute — please try again.')
        return
      }

      // goal_progress comes back from the API; fall back to local arithmetic.
      const updated = Number(data.goal_progress?.current_tokens)
      setCurrent(Number.isFinite(updated) ? updated : current + chosen)
      setThanks(true)
      setOpen(false)
      setCustomAmount('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-foreground/[0.02] border border-foreground/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-1.5">
            🎯 {goal.title}
          </h4>
          {goal.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>
          )}
        </div>
        <span className="text-xs font-bold text-pink-400 whitespace-nowrap">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-foreground/5 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 via-pink-500 to-orange-400 transition-all duration-1000 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          {formatViews(current)} / {formatViews(target)} tokens
        </span>
        <span className="text-muted-foreground">
          {complete ? 'Completed! 🎉' : `${formatViews(remaining)} to go`}
        </span>
      </div>

      {goal.reward_description && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Reward:</span> {goal.reward_description}
        </p>
      )}

      {thanks && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-500">
          <Check className="h-3.5 w-3.5" /> Thanks for contributing!
        </p>
      )}

      {/* Contribute — hidden for the goal's own creator, who cannot contribute. */}
      {!complete && !isOwner && (
        open ? (
          <div className="space-y-2.5 pt-1">
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setAmount(p); setCustomAmount('') }}
                  className={cn(
                    'flex-1 rounded-full border px-2 py-1.5 text-xs font-medium transition',
                    !customAmount.trim() && amount === p
                      ? 'border-pink-500 bg-pink-500/10 text-pink-400'
                      : 'border-foreground/10 text-muted-foreground hover:bg-foreground/5',
                  )}
                >
                  {p}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={100000}
                inputMode="numeric"
                placeholder="Custom"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-20 rounded-full border border-foreground/10 bg-transparent px-3 py-1.5 text-xs focus:border-pink-500 focus:outline-none"
                aria-label="Custom token amount"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-2 rounded-full text-xs"
                disabled={!validAmount || busy}
                onClick={contribute}
              >
                {busy ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                ) : (
                  <><Gift className="h-3.5 w-3.5" /> Send {validAmount ? chosen : ''} tokens</>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-xs"
                onClick={() => { setOpen(false); setError(null) }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 rounded-full border-pink-500/30 text-pink-400 hover:bg-pink-500/10 text-xs"
            onClick={() => { setOpen(true); setThanks(false) }}
          >
            <Gift className="h-3.5 w-3.5" /> Contribute
          </Button>
        )
      )}
    </div>
  )
}
