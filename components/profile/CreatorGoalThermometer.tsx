'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Gift, Target, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatViews } from '@/lib/utils'

interface GoalData {
  id: string
  name: string
  description?: string | null
  current_amount: number
  target_amount: number
  reward?: string | null
  category?: string | null
  created_at?: string
}

interface CreatorGoalThermometerProps {
  goals: GoalData[]
  creatorName: string
}

export default function CreatorGoalThermometer({ goals, creatorName }: CreatorGoalThermometerProps) {
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
    <div className="rounded-3xl border border-foreground/5 bg-card/50 backdrop-blur-sm p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-pink-400" />
        <h3 className="font-semibold text-lg">Goals &amp; Gifts</h3>
      </div>

      {goals.map((goal) => {
        const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
        const remaining = goal.target_amount - goal.current_amount

        return (
          <div key={goal.id} className="space-y-3 p-4 rounded-2xl bg-foreground/[0.02] border border-foreground/5">
            {/* Goal name */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  {goal.category === 'equipment' ? '🔧' : goal.category === 'trip' ? '✈️' : goal.category === 'community' ? '👥' : '🎯'}
                  {goal.name}
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
              {/* Reward marker */}
              {goal.reward && (
                <div className="absolute top-1/2 -translate-y-1/2 h-5 w-0.5 bg-yellow-400/80" style={{ left: `${Math.min(100, Math.round((parseFloat(goal.reward) / goal.target_amount) * 100))}%` }}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-yellow-400 whitespace-nowrap font-medium">🎁</span>
                </div>
              )}
            </div>

            {/* Amounts */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{formatViews(goal.current_amount)}</span>
                {' '}of{' '}
                <span className="font-semibold text-foreground">{formatViews(goal.target_amount)}</span>
              </span>
              <span className="text-muted-foreground">
                {remaining > 0 ? `${formatViews(remaining)} to go` : 'Completed! 🎉'}
              </span>
            </div>

            {/* Contribute */}
            {remaining > 0 && (
              <Button size="sm" variant="outline" className="w-full gap-2 rounded-full border-pink-500/30 text-pink-400 hover:bg-pink-500/10 text-xs">
                <Gift className="h-3.5 w-3.5" /> Contribute
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
