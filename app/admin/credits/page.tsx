'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BadgeDollarSign, Gift, TrendingDown, Clock, CheckCircle, XCircle,
  RefreshCw, Search, ChevronDown, ChevronUp, AlertCircle, Users,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreditRequest {
  id: string
  type: 'gift' | 'loan'
  amount: number
  reason: string
  status: 'pending' | 'approved' | 'denied'
  review_notes: string | null
  reviewed_at: string | null
  created_at: string
  user: { id: string; username: string; display_name: string } | null
  reviewer: { username: string; display_name: string } | null
}

interface Grant {
  id: string
  type: 'gift' | 'loan'
  amount: number
  notes: string | null
  created_at: string
  user_id: string
  granted_by: string
}

interface DashboardStats {
  pendingRequests: number
  approvedRequests: number
  deniedRequests: number
  totalGiftOutstanding: number
  totalLoanOutstanding: number
}

type Tab = 'requests' | 'issue' | 'history' | 'loans'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return `$${n.toFixed(2)}` }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Issue Credits Form ────────────────────────────────────────────────────────

function IssueCreditsPanel() {
  const [username, setUsername] = useState('')
  const [foundUser, setFoundUser] = useState<{ id: string; display_name: string; username: string } | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const [type, setType] = useState<'gift' | 'loan'>('gift')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function searchUser() {
    if (!username.trim()) return
    setSearching(true)
    setSearchErr(null)
    setFoundUser(null)
    setResult(null)
    try {
      const r = await fetch(`/api/admin/users/lookup?username=${encodeURIComponent(username.trim())}`)
      const j = await r.json()
      if (!r.ok) { setSearchErr(j.error ?? 'User not found'); return }
      setFoundUser(j.user)
    } catch {
      setSearchErr('Network error')
    } finally {
      setSearching(false)
    }
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault()
    if (!foundUser) return
    const n = parseFloat(amount)
    if (!n || n <= 0 || n > 10000) { setResult({ ok: false, msg: 'Amount must be between $0.01 and $10,000' }); return }
    setSubmitting(true)
    setResult(null)
    try {
      const r = await fetch('/api/admin/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: foundUser.id, type, amount: n, notes: notes || undefined }),
      })
      const j = await r.json()
      if (!r.ok) setResult({ ok: false, msg: j.error ?? 'Failed' })
      else {
        setResult({ ok: true, msg: `✅ ${fmt(n)} in ${type} credits issued to ${foundUser.display_name || foundUser.username}` })
        setAmount(''); setNotes('')
      }
    } catch {
      setResult({ ok: false, msg: 'Network error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Step 1: find user */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          1. Find User
        </label>
        <div className="flex gap-2">
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchUser()}
            placeholder="Username or email…"
            className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50"
          />
          <button
            onClick={searchUser}
            disabled={searching || !username.trim()}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Search className="h-4 w-4" />
            {searching ? 'Searching…' : 'Find'}
          </button>
        </div>
        {searchErr && <p className="mt-2 text-xs text-red-400">{searchErr}</p>}
        {foundUser && (
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
              {(foundUser.display_name || foundUser.username).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold">{foundUser.display_name || foundUser.username}</div>
              <div className="text-xs text-muted-foreground">@{foundUser.username}</div>
            </div>
            <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />
          </div>
        )}
      </div>

      {/* Step 2: credit form (only visible once user is found) */}
      {foundUser && (
        <form onSubmit={handleGrant} className="space-y-4">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            2. Credit Details
          </label>

          {/* Type toggle */}
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
                {t === 'gift' ? '🎁 Gift Credit' : '💸 Loan Credit'}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground -mt-2">
            {type === 'gift'
              ? 'Free credits — no repayment. Creator earns $0 from credit-funded purchases.'
              : 'Loan credits — auto-repaid from creator cashouts or manual Stripe payment.'}
          </p>

          {/* Amount */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              type="number" min="0.01" max="10000" step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full pl-7 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50"
            />
          </div>

          {/* Notes */}
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Admin notes (optional) — e.g. Contest winner, onboarding bonus…"
            maxLength={200}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50"
          />

          {result && (
            <div className={`p-3 rounded-xl text-sm ${result.ok ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
              {result.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-black font-bold rounded-xl transition disabled:opacity-50"
          >
            {submitting ? 'Issuing…' : `Issue ${parseFloat(amount || '0') > 0 ? fmt(parseFloat(amount)) : '—'} in ${type} credits`}
          </button>
        </form>
      )}
    </div>
  )
}

// ── Requests Tab ──────────────────────────────────────────────────────────────

function RequestsTab({ refresh }: { refresh: () => void }) {
  const [requests, setRequests] = useState<CreditRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'denied' | 'all'>('pending')
  const [actionId, setActionId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const url = filter === 'all' ? '/api/admin/credits/requests' : `/api/admin/credits/requests?status=${filter}`
    const r = await fetch(url)
    const j = await r.json()
    setRequests(j.requests ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function decide(id: string, action: 'approve' | 'deny') {
    setProcessing(id)
    setError(null)
    try {
      const r = await fetch('/api/admin/credits/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, action, reviewNotes: reviewNotes[id] || undefined }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'Failed'); return }
      setRequests(prev => prev.filter(req => req.id !== id))
      setActionId(null)
      refresh()
    } catch {
      setError('Network error')
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {(['pending', 'approved', 'denied', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setError(null) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${
              filter === f ? 'bg-primary text-black' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            {f}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition" title="Refresh">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
          {filter === 'pending' ? '✅ No pending requests' : 'No requests found'}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
              >
                {/* Type badge */}
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
                  req.type === 'gift'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {req.type === 'gift' ? '🎁 Gift' : '💸 Loan'}
                </span>

                {/* Amount */}
                <span className="font-bold text-sm">{fmt(req.amount)}</span>

                {/* User */}
                <span className="text-sm text-muted-foreground">
                  @{req.user?.username ?? '—'}
                  {req.user?.display_name ? ` · ${req.user.display_name}` : ''}
                </span>

                {/* Status */}
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                  req.status === 'pending'  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                  req.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                             'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {req.status}
                </span>

                {/* Date + chevron */}
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{fmtDate(req.created_at)}</span>
                {expandedId === req.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>

              {/* Expanded */}
              {expandedId === req.id && (
                <div className="px-4 pb-4 border-t border-border space-y-3 pt-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">User Reason</p>
                    <p className="text-sm text-white/90 bg-white/5 rounded-lg px-3 py-2">{req.reason}</p>
                  </div>

                  {req.status !== 'pending' && req.review_notes && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Admin Notes</p>
                      <p className="text-sm text-white/70">{req.review_notes}</p>
                    </div>
                  )}

                  {req.status === 'pending' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Admin notes (optional)…"
                        value={reviewNotes[req.id] ?? ''}
                        onChange={e => setReviewNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                        maxLength={200}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => decide(req.id, 'approve')}
                          disabled={processing === req.id}
                          className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 font-semibold text-sm rounded-lg transition disabled:opacity-50"
                        >
                          {processing === req.id ? '…' : '✅ Approve'}
                        </button>
                        <button
                          onClick={() => decide(req.id, 'deny')}
                          disabled={processing === req.id}
                          className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold text-sm rounded-lg transition disabled:opacity-50"
                        >
                          {processing === req.id ? '…' : '✗ Deny'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Grants History Tab ────────────────────────────────────────────────────────

function GrantsHistoryTab() {
  const [grants, setGrants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/credits/history')
      .then(r => r.json())
      .then(j => setGrants(j.grants ?? []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = grants.filter(g => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      g.user?.username?.toLowerCase().includes(s) ||
      g.user?.display_name?.toLowerCase().includes(s) ||
      g.notes?.toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by user or notes…"
          className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
          No grants found
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Notes</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(g => (
                <tr key={g.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{g.user?.display_name || g.user?.username || '—'}</div>
                    <div className="text-xs text-muted-foreground">@{g.user?.username ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      g.type === 'gift'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {g.type === 'gift' ? '🎁 Gift' : '💸 Loan'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{fmt(parseFloat(g.amount))}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell max-w-[200px] truncate">{g.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">{fmtDate(g.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Outstanding Loans Tab ─────────────────────────────────────────────────────

function OutstandingLoansTab() {
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/credits/loans')
      .then(r => r.json())
      .then(j => setLoans(j.loans ?? []))
      .finally(() => setLoading(false))
  }, [])

  const totalOutstanding = loans.reduce((s, l) => s + parseFloat(l.loan_balance ?? '0'), 0)

  return (
    <div className="space-y-4">
      {totalOutstanding > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Total Platform Loan Exposure</div>
          <div className="text-2xl font-black text-amber-400">{fmt(totalOutstanding)}</div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : loans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
          ✅ No outstanding loans
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Loan Balance</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Repaid</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gift Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loans.map(l => (
                <tr key={l.user_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{l.user?.display_name || l.user?.username || '—'}</div>
                    <div className="text-xs text-muted-foreground">@{l.user?.username ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-amber-400">{fmt(parseFloat(l.loan_balance))}</td>
                  <td className="px-4 py-3 text-right text-green-400">{fmt(parseFloat(l.loan_repaid ?? '0'))}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{fmt(parseFloat(l.gift_balance ?? '0'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminCreditsPage() {
  const [tab, setTab] = useState<Tab>('requests')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsKey, setStatsKey] = useState(0)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const r = await fetch('/api/admin/credits/requests?stats=1')
      const j = await r.json()
      if (j.stats) setStats(j.stats)
    } catch {
      // non-fatal
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats, statsKey])

  const refreshStats = () => setStatsKey(k => k + 1)

  const statCards = stats ? [
    { label: 'Pending Requests',  value: stats.pendingRequests,      icon: Clock,           color: 'text-yellow-400', urgent: stats.pendingRequests > 0 },
    { label: 'Approved',          value: stats.approvedRequests,     icon: CheckCircle,     color: 'text-green-400'  },
    { label: 'Denied',            value: stats.deniedRequests,       icon: XCircle,         color: 'text-red-400'    },
    { label: 'Gift Outstanding',  value: fmt(stats.totalGiftOutstanding),  icon: Gift,       color: 'text-green-400'  },
    { label: 'Loans Outstanding', value: fmt(stats.totalLoanOutstanding),  icon: TrendingDown, color: 'text-amber-400' },
  ] : []

  const tabs: { id: Tab; label: string }[] = [
    { id: 'requests', label: '📋 Requests' },
    { id: 'issue',    label: '💳 Issue Credits' },
    { id: 'history',  label: '📜 Grant History' },
    { id: 'loans',    label: '⚠️ Outstanding Loans' },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <BadgeDollarSign className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Credits Management</h1>
            <p className="text-sm text-muted-foreground">Issue, review requests, and monitor platform credit exposure</p>
          </div>
        </div>
        <button onClick={refreshStats} className="p-2 rounded-lg hover:bg-white/5 transition" title="Refresh stats">
          <RefreshCw className={`h-4 w-4 text-muted-foreground ${statsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {statCards.map(({ label, value, icon: Icon, color, urgent }) => (
            <div key={label} className={`rounded-xl bg-card border p-4 ${urgent ? 'border-yellow-500/40' : 'border-border'}`}>
              <Icon className={`h-4 w-4 mb-2 ${color}`} />
              <div className="text-lg font-bold">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pending alert */}
      {(stats?.pendingRequests ?? 0) > 0 && (
        <div
          onClick={() => setTab('requests')}
          className="flex items-center gap-3 mb-6 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-400 hover:bg-yellow-500/15 transition-colors cursor-pointer"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span><strong>{stats!.pendingRequests} credit request{stats!.pendingRequests !== 1 ? 's' : ''}</strong> waiting for review</span>
          <span className="ml-auto text-xs">Review →</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id ? 'bg-card text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'requests' && <RequestsTab refresh={refreshStats} />}
        {tab === 'issue'    && <IssueCreditsPanel />}
        {tab === 'history'  && <GrantsHistoryTab />}
        {tab === 'loans'    && <OutstandingLoansTab />}
      </div>
    </div>
  )
}
