'use client'

import { useState, useTransition } from 'react'
import {
  Users, Shield, Settings, Search, ChevronDown, ShieldCheck,
  UserX, UserCheck, Trash2, Crown, Eye, EyeOff, Plus, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface User {
  id: string
  username: string | null
  display_name: string | null
  role: string | null
  is_creator: boolean | null
  suspended_at: string | null
  suspension_reason: string | null
  created_at: string
  avatar_url?: string | null
  email?: string | null
}

interface TeamMember {
  id: string
  username: string | null
  display_name: string | null
  role: string | null
  created_at: string
  suspended_at: string | null
}

interface Props {
  currentUserRole: string
  currentUserId: string
  allUsers: User[]
  team: TeamMember[]
  stats: { totalUsers: number; totalVideos: number; activeCreators: number; suspendedUsers: number }
}

type Tab = 'overview' | 'users' | 'team' | 'permissions'

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
  moderator: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  creator: 'bg-green-500/10 text-green-400 border-green-500/20',
  user: 'bg-muted text-muted-foreground border-border',
}

export default function SuperadminControlPanel({ currentUserRole, currentUserId, allUsers, team, stats }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null)
  const [, startTransition] = useTransition()

  // New moderator form
  const [showNewMod, setShowNewMod] = useState(false)
  const [newModEmail, setNewModEmail] = useState('')
  const [newModPassword, setNewModPassword] = useState('')
  const [newModName, setNewModName] = useState('')
  const [creating, setCreating] = useState(false)

  const isSuperAdmin = currentUserRole === 'superadmin'

  const flash = (msg: string, ok: boolean) => {
    setFeedback({ msg, ok })
    setTimeout(() => setFeedback(null), 4000)
  }

  const doUserAction = async (userId: string, action: string, payload?: object) => {
    const res = await fetch('/api/admin/users/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, ...payload }),
    })
    const d = await res.json()
    if (res.ok) {
      flash(d.message ?? 'Done', true)
      setTimeout(() => window.location.reload(), 1000)
    } else {
      flash(d.error ?? 'Failed', false)
    }
  }

  const createModerator = async () => {
    if (!newModEmail || !newModPassword) return
    setCreating(true)
    const res = await fetch('/api/admin/moderators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newModEmail, password: newModPassword, displayName: newModName }),
    })
    const d = await res.json()
    if (res.ok) {
      flash(`Moderator ${newModEmail} created`, true)
      setShowNewMod(false)
      setNewModEmail(''); setNewModPassword(''); setNewModName('')
      setTimeout(() => window.location.reload(), 1200)
    } else {
      flash(d.error ?? 'Failed to create', false)
    }
    setCreating(false)
  }

  // Filter users
  const filteredUsers = allUsers.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || (u.username?.toLowerCase().includes(q)) || (u.display_name?.toLowerCase().includes(q)) || (u.email?.toLowerCase().includes(q))
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const matchStatus = statusFilter === 'all' || (statusFilter === 'suspended' ? !!u.suspended_at : !u.suspended_at)
    return matchSearch && matchRole && matchStatus
  })

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Settings },
    { id: 'users', label: `All Users (${allUsers.length})`, icon: Users },
    { id: 'team', label: `Admin Team (${team.length})`, icon: Shield },
    { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground mt-1">Full control over HapiEats TV</p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${feedback.ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Platform stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers, color: 'text-blue-400' },
              { label: 'Total Videos', value: stats.totalVideos, color: 'text-green-400' },
              { label: 'Active Creators', value: stats.activeCreators, color: 'text-cyan-400' },
              { label: 'Suspended', value: stats.suspendedUsers, color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-5">
                <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Role distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">User Role Distribution</h3>
            <div className="space-y-2">
              {['superadmin', 'admin', 'moderator', 'creator', 'user'].map(role => {
                const count = allUsers.filter(u => u.role === role || (!u.role && role === 'user')).length
                const pct = allUsers.length ? Math.round((count / allUsers.length) * 100) : 0
                return (
                  <div key={role} className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border w-24 text-center flex-shrink-0 ${ROLE_COLORS[role] ?? ROLE_COLORS.user}`}>{role}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="bg-primary/60 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Platform controls */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Platform Controls</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Moderation Queue', desc: 'Review pending reports and flagged content', href: '/admin/moderation' },
                { label: 'User Management', desc: 'Search, suspend, promote, or delete users', action: () => setTab('users') },
                { label: 'Team Management', desc: 'Add or remove admin/moderator accounts', action: () => setTab('team') },
                { label: 'Video Management', desc: 'Review, hide, or remove content', href: '/admin/videos' },
                { label: 'Analytics', desc: 'View platform metrics and growth', href: '/admin/analytics' },
                { label: 'Reports', desc: 'Manage user-submitted reports', href: '/admin/reports' },
              ].map(({ label, desc, href, action }) => (
                <a
                  key={label}
                  href={href ?? '#'}
                  onClick={action ? (e) => { e.preventDefault(); action() } : undefined}
                  className="p-4 bg-muted/40 rounded-xl hover:bg-muted/70 transition-colors cursor-pointer"
                >
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                </a>
              ))}
            </div>
          </div>

          {/* Mux sync */}
          <MuxSyncPanel onFlash={flash} />
        </div>
      )}

      {/* ── All Users Tab ─────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, or email…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All roles</option>
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="creator">Creator</option>
              <option value="user">User</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="text-xs text-muted-foreground">{filteredUsers.length} users found</div>

          {/* Users table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                  {isSuperAdmin && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.display_name ?? u.username ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">@{u.username}</div>
                      {u.email && <div className="text-xs text-muted-foreground">{u.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[u.role ?? 'user'] ?? ROLE_COLORS.user}`}>
                        {u.role ?? 'user'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.suspended_at ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Suspended</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    {isSuperAdmin && u.id !== currentUserId && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Suspend/Unsuspend */}
                          {u.suspended_at ? (
                            <button
                              onClick={() => doUserAction(u.id, 'unsuspend')}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                              title="Unsuspend"
                            >
                              <UserCheck className="h-3 w-3" /> Reinstate
                            </button>
                          ) : (
                            <button
                              onClick={() => doUserAction(u.id, 'suspend')}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                              title="Suspend"
                            >
                              <UserX className="h-3 w-3" /> Suspend
                            </button>
                          )}
                          {/* Promote to moderator */}
                          {!['superadmin', 'admin', 'moderator'].includes(u.role ?? '') && (
                            <button
                              onClick={() => doUserAction(u.id, 'set_role', { role: 'moderator' })}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                              title="Make moderator"
                            >
                              <Shield className="h-3 w-3" /> Mod
                            </button>
                          )}
                          {/* Demote */}
                          {['moderator', 'admin'].includes(u.role ?? '') && (
                            <button
                              onClick={() => doUserAction(u.id, 'set_role', { role: 'user' })}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                              title="Remove privileges"
                            >
                              <ChevronDown className="h-3 w-3" /> Demote
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    {isSuperAdmin && u.id === currentUserId && (
                      <td className="px-4 py-3 text-xs text-muted-foreground italic">You</td>
                    )}
                  </tr>
                ))}
                {!filteredUsers.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Team Tab ─────────────────────────────────────────── */}
      {tab === 'team' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Admin Team</h2>
            {isSuperAdmin && (
              <Button size="sm" onClick={() => setShowNewMod(v => !v)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Moderator
              </Button>
            )}
          </div>

          {/* New moderator form */}
          {showNewMod && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-medium text-sm">Create Moderator Account</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                  <Input placeholder="mod@hapieatstv.com" value={newModEmail} onChange={e => setNewModEmail(e.target.value)} type="email" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Password</label>
                  <Input placeholder="Strong password…" value={newModPassword} onChange={e => setNewModPassword(e.target.value)} type="password" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
                  <Input placeholder="Moderator Name" value={newModName} onChange={e => setNewModName(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={createModerator} disabled={creating || !newModEmail || !newModPassword}>
                  {creating ? 'Creating…' : 'Create Account'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewMod(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Team table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Added</th>
                  {isSuperAdmin && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {team.map(m => (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.display_name ?? m.username ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">@{m.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[m.role ?? 'user'] ?? ROLE_COLORS.user}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    {isSuperAdmin && m.id !== currentUserId && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {m.role === 'moderator' && (
                            <button
                              onClick={() => doUserAction(m.id, 'set_role', { role: 'admin' })}
                              className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-1"
                            >
                              <Crown className="h-3 w-3" /> Promote to Admin
                            </button>
                          )}
                          {m.role === 'admin' && (
                            <button
                              onClick={() => doUserAction(m.id, 'set_role', { role: 'moderator' })}
                              className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                            >
                              Demote
                            </button>
                          )}
                          {m.role !== 'superadmin' && (
                            <button
                              onClick={() => doUserAction(m.id, 'set_role', { role: 'user' })}
                              className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors inline-flex items-center gap-1"
                            >
                              <UserX className="h-3 w-3" /> Remove
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    {isSuperAdmin && m.id === currentUserId && (
                      <td className="px-4 py-3 text-xs text-muted-foreground italic">You</td>
                    )}
                  </tr>
                ))}
                {!team.length && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No team members yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Permissions Tab ──────────────────────────────────── */}
      {tab === 'permissions' && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Role Permission Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Permission</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">User</th>
                    <th className="text-center py-2 px-3 font-medium text-blue-400">Mod</th>
                    <th className="text-center py-2 px-3 font-medium text-primary">Admin</th>
                    <th className="text-center py-2 px-3 font-medium text-purple-400">Superadmin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {[
                    { perm: 'Watch videos', user: true, mod: true, admin: true, super: true },
                    { perm: 'Upload videos', user: true, mod: true, admin: true, super: true },
                    { perm: 'Comment', user: true, mod: true, admin: true, super: true },
                    { perm: 'Report content', user: true, mod: true, admin: true, super: true },
                    { perm: 'View moderation queue', user: false, mod: true, admin: true, super: true },
                    { perm: 'Flag / hide videos', user: false, mod: true, admin: true, super: true },
                    { perm: 'Suspend users', user: false, mod: false, admin: true, super: true },
                    { perm: 'Manage all videos', user: false, mod: true, admin: true, super: true },
                    { perm: 'View all users', user: false, mod: false, admin: true, super: true },
                    { perm: 'Change user roles', user: false, mod: false, admin: false, super: true },
                    { perm: 'Create moderator accounts', user: false, mod: false, admin: false, super: true },
                    { perm: 'Platform settings', user: false, mod: false, admin: true, super: true },
                    { perm: 'Delete content permanently', user: false, mod: false, admin: false, super: true },
                  ].map(({ perm, user, mod, admin, super: s }) => (
                    <tr key={perm}>
                      <td className="py-2.5 pr-4 text-sm">{perm}</td>
                      {[user, mod, admin, s].map((allowed, i) => (
                        <td key={i} className="text-center py-2.5 px-3">
                          {allowed
                            ? <Eye className="h-3.5 w-3.5 text-green-400 mx-auto" />
                            : <EyeOff className="h-3.5 w-3.5 text-muted-foreground/30 mx-auto" />
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-2">Access Controls</h3>
            <p className="text-sm text-muted-foreground mb-4">These are enforced server-side via Supabase RLS and API route checks. Regular users cannot access any <code className="bg-muted px-1 py-0.5 rounded text-xs">/admin/*</code> routes.</p>
            <div className="space-y-2 text-sm">
              {[
                { route: '/admin/*', access: 'moderator, admin, superadmin only', color: 'text-blue-400' },
                { route: '/admin/settings', access: 'admin, superadmin only', color: 'text-primary' },
                { route: '/api/admin/moderators', access: 'superadmin only', color: 'text-purple-400' },
                { route: '/api/admin/users/action', access: 'admin, superadmin only', color: 'text-primary' },
                { route: '/api/admin/reports', access: 'moderator, admin, superadmin', color: 'text-blue-400' },
                { route: '/api/admin/videos', access: 'moderator, admin, superadmin', color: 'text-blue-400' },
              ].map(({ route, access, color }) => (
                <div key={route} className="flex items-center gap-3">
                  <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono flex-shrink-0">{route}</code>
                  <span className={`text-xs ${color}`}>{access}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mux Sync Panel ────────────────────────────────────────────────────────────
function MuxSyncPanel({ onFlash }: { onFlash: (msg: string, ok: boolean) => void }) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{ assetsChecked: number; videosUpdated: number; uploadsFixed: number } | null>(null)

  const runSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/mux/sync', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setResult(d)
        onFlash(`Synced: ${d.videosUpdated} videos updated, ${d.uploadsFixed} uploads fixed`, true)
      } else {
        onFlash(d.error ?? 'Sync failed', false)
      }
    } catch {
      onFlash('Sync failed — check console', false)
    }
    setSyncing(false)
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold">Mux Video Sync</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Pull asset status from Mux API and update video records. Fixes videos stuck in "uploading" or "processing" that missed webhook callbacks.
          </p>
        </div>
        <Button size="sm" onClick={runSync} disabled={syncing} className="shrink-0 gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </Button>
      </div>
      {result && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 space-y-0.5">
          <div>Assets checked: <span className="text-foreground font-medium">{result.assetsChecked}</span></div>
          <div>Videos updated: <span className="text-green-400 font-medium">{result.videosUpdated}</span></div>
          <div>Stuck uploads fixed: <span className="text-cyan-400 font-medium">{result.uploadsFixed}</span></div>
        </div>
      )}
      <div className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">
        <strong className="text-foreground">Webhook URL:</strong>{' '}
        <code className="bg-muted px-1.5 py-0.5 rounded font-mono">https://www.hapieatstv.com/api/mux/webhook</code>
        <span className="ml-2">— add this in your <a href="https://dashboard.mux.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Mux dashboard</a> under Settings → Webhooks</span>
      </div>
    </div>
  )
}
