'use client'

import { useState } from 'react'
import { Target, Plus, CheckCircle2, AlertCircle, Clock, Gift, Zap, X } from 'lucide-react'
import Link from 'next/link'

interface Goal {
  id: string
  title: string
  description: string | null
  target_tokens: number
  current_tokens: number
  deadline: string | null
  reward_description: string | null
  status: string
  is_featured: boolean
  created_at: string
}

interface Props {
  goals: Goal[]
  creatorId: string
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  completed: 'bg-primary/10 text-primary border-primary/20',
  expired: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-muted text-muted-foreground border-border',
}

const STATUS_ICONS: Record<string, string> = {
  active: '🎯',
  completed: '✅',
  expired: '⏰',
  cancelled: '❌',
}

export default function CreatorGoalsClient({ goals: initialGoals, creatorId }: Props) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    target_tokens: '',
    deadline: '',
    reward_description: '',
  })

  async function createGoal(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const target = parseInt(form.target_tokens)
      if (isNaN(target) || target < 1) throw new Error('Target must be at least 1 token')

      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          target_tokens: target,
          deadline: form.deadline || null,
          reward_description: form.reward_description || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create goal')

      setGoals(prev => [data.goal, ...prev])
      setSuccess('Goal created! Fans can now contribute tokens.')
      setShowForm(false)
      setForm({ title: '', description: '', target_tokens: '', deadline: '', reward_description: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const pastGoals = goals.filter(g => g.status !== 'active')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Creator Goals
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set fan-funded goals and share your dreams with supporters.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Goal
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{success}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> New Goal</h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={createGoal} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Goal Title *</label>
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. New camera for better food videos"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Target Tokens *</label>
                <input
                  required
                  type="number"
                  min="1"
                  max="1000000"
                  value={form.target_tokens}
                  onChange={e => setForm(f => ({ ...f, target_tokens: e.target.value }))}
                  placeholder="5000"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Deadline (optional)</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Description (optional)</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Why are you raising these tokens?"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Reward for Supporters (optional)</label>
              <input
                value={form.reward_description}
                onChange={e => setForm(f => ({ ...f, reward_description: e.target.value }))}
                placeholder="e.g. Exclusive behind-the-scenes content for all contributors"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {submitting ? 'Creating…' : 'Create Goal'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            <Zap className="inline h-3 w-3 mr-0.5 text-primary" />
            You'll receive 70% of token value in cash. Minimum 1 token, maximum 1,000,000 tokens.
          </p>
        </div>
      )}

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Active Goals</h2>
          <div className="space-y-4">
            {activeGoals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
          </div>
        </section>
      )}

      {/* Empty active */}
      {activeGoals.length === 0 && !showForm && (
        <div className="py-16 text-center mb-10">
          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground mb-4">No active goals. Create one to start receiving fan support!</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Create Your First Goal
          </button>
        </div>
      )}

      {/* Past goals */}
      {pastGoals.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Past Goals</h2>
          <div className="space-y-3">
            {pastGoals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function GoalCard({ goal }: { goal: Goal }) {
  const pct = goal.target_tokens > 0
    ? Math.min(100, Math.round((goal.current_tokens / goal.target_tokens) * 100))
    : 0
  const isComplete = goal.status === 'completed'

  return (
    <div className={`bg-card border rounded-xl p-5 ${isComplete ? 'border-primary/30' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[goal.status] ?? ''}`}>
              {STATUS_ICONS[goal.status]} {goal.status}
            </span>
            {goal.is_featured && (
              <span className="text-[10px] text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 rounded-full font-bold">Featured</span>
            )}
          </div>
          <h3 className="font-semibold text-sm">{goal.title}</h3>
          {goal.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-black text-primary">{pct}%</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all ${isComplete ? 'bg-primary' : 'bg-primary/70'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          <Zap className="inline h-3 w-3 text-primary mr-0.5" />
          {goal.current_tokens.toLocaleString()} / {goal.target_tokens.toLocaleString()} tokens
        </span>
        {goal.deadline && (
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(goal.deadline).toLocaleDateString()}
          </span>
        )}
      </div>

      {goal.reward_description && (
        <div className="mt-3 text-xs text-muted-foreground flex items-start gap-1.5">
          <Gift className="h-3 w-3 mt-0.5 text-primary shrink-0" />
          <span>{goal.reward_description}</span>
        </div>
      )}
    </div>
  )
}
