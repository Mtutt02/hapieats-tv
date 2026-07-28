'use client'

import { useState } from 'react'
import { Shield, ShieldCheck, UserX, UserCheck, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TeamMember {
  id: string
  username: string
  display_name: string | null
  role: string
  created_at: string
  suspended_at: string | null
}

interface Props {
  team: TeamMember[]
  currentUserRole: string
  currentUserId: string
}

const ROLE_BADGES: Record<string, string> = {
  superadmin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  admin:      'bg-primary/10 text-primary border-primary/20',
  moderator:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

export default function TeamManagementClient({ team: initial, currentUserRole, currentUserId }: Props) {
  const [team, setTeam] = useState(initial)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState<'moderator' | 'admin'>('moderator')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null)

  const isSuperAdmin = currentUserRole === 'superadmin'

  const flash = (id: string, msg: string, ok: boolean) => {
    setFeedback({ id, msg, ok })
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleAddModerator = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formEmail || !formPassword) return
    setAdding(true); setAddError(null); setAddSuccess(null)

    const res = await fetch('/api/admin/moderators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: formEmail, password: formPassword, displayName: formName }),
    })
    const json = await res.json()
    if (res.ok) {
      setAddSuccess(`Account created for ${formEmail}`)
      setFormEmail(''); setFormPassword(''); setFormName('')
      // Refresh team list
      fetch('/api/admin/moderators').then(r => r.json()).then(data => {
        if (Array.isArray(data)) setTeam(data)
      })
      // If admin role needed, promote them
      if (formRole === 'admin' && json.userId) {
        await fetch('/api/admin/moderators', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: json.userId, role: 'admin' }),
        })
      }
      setTimeout(() => setShowAddForm(false), 2000)
    } else {
      setAddError(json.error ?? 'Failed to create account')
    }
    setAdding(false)
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(userId)
    const res = await fetch('/api/admin/moderators', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    const json = await res.json()
    if (res.ok) {
      setTeam(t => t.map(m => m.id === userId ? { ...m, role: newRole } : m))
      flash(userId, `Role updated to ${newRole}`, true)
    } else {
      flash(userId, json.error ?? 'Failed', false)
    }
    setActionLoading(null)
  }

  const handleSuspend = async (userId: string, suspend: boolean) => {
    setActionLoading(userId)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: suspend ? 'suspend' : 'unsuspend' }),
    })
    const json = await res.json()
    if (res.ok) {
      setTeam(t => t.map(m => m.id === userId ? { ...m, suspended_at: suspend ? new Date().toISOString() : null } : m))
      flash(userId, suspend ? 'Account suspended' : 'Account restored', true)
    } else {
      flash(userId, json.error ?? 'Failed', false)
    }
    setActionLoading(null)
  }

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Team members */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Team Members</h2>
          {isSuperAdmin && (
            <Button size="sm" onClick={() => setShowAddForm(s => !s)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Moderator
            </Button>
          )}
        </div>

        {/* Add form */}
        {showAddForm && (
          <form onSubmit={handleAddModerator} className="px-5 py-4 border-b border-border bg-muted/30 space-y-4">
            <h3 className="text-sm font-semibold">Create New Team Account</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mod-email">Email *</Label>
                <Input
                  id="mod-email"
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="mod@hapieatstv.com"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="mod-name">Display Name</Label>
                <Input
                  id="mod-name"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Content Moderator"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="mod-pw">Password *</Label>
                <Input
                  id="mod-pw"
                  type="password"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder="Strong password"
                  className="mt-1.5"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <Label>Role</Label>
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value as any)}
                  className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
            {addSuccess && <p className="text-sm text-green-400">{addSuccess}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={adding} className="gap-1.5">
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Account
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Team list */}
        <div className="divide-y divide-border">
          {team.length === 0 && (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">No team members yet</div>
          )}
          {team.map(member => (
            <div key={member.id} className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{member.display_name || member.username}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_BADGES[member.role] ?? 'bg-muted text-muted-foreground border-border'}`}>
                    {member.role}
                  </span>
                  {member.suspended_at && (
                    <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">suspended</span>
                  )}
                  {member.id === currentUserId && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">@{member.username} · joined {new Date(member.created_at).toLocaleDateString()}</div>
              </div>

              {/* Feedback */}
              {feedback?.id === member.id && (
                <span className={`text-xs ${feedback.ok ? 'text-green-400' : 'text-destructive'}`}>{feedback.msg}</span>
              )}

              {/* Actions — only superadmin, not on self */}
              {isSuperAdmin && member.id !== currentUserId && member.role !== 'superadmin' && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {member.role === 'moderator' && (
                    <Button
                      size="sm" variant="outline"
                      className="text-xs h-7"
                      disabled={actionLoading === member.id}
                      onClick={() => handleRoleChange(member.id, 'admin')}
                    >
                      <ShieldCheck className="h-3 w-3 mr-1" /> Promote
                    </Button>
                  )}
                  {member.role === 'admin' && (
                    <Button
                      size="sm" variant="outline"
                      className="text-xs h-7"
                      disabled={actionLoading === member.id}
                      onClick={() => handleRoleChange(member.id, 'moderator')}
                    >
                      <Shield className="h-3 w-3 mr-1" /> Demote
                    </Button>
                  )}
                  {!member.suspended_at ? (
                    <Button
                      size="sm" variant="outline"
                      className="text-xs h-7 border-red-500/40 text-red-400 hover:bg-red-500/10"
                      disabled={actionLoading === member.id}
                      onClick={() => handleSuspend(member.id, true)}
                    >
                      <UserX className="h-3 w-3 mr-1" /> Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm" variant="outline"
                      className="text-xs h-7"
                      disabled={actionLoading === member.id}
                      onClick={() => handleSuspend(member.id, false)}
                    >
                      <UserCheck className="h-3 w-3 mr-1" /> Restore
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Permissions matrix */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Permission Matrix</h2>
          <p className="text-sm text-muted-foreground mt-0.5">What each role can do</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-muted-foreground font-medium">Permission</th>
                <th className="px-4 py-3 text-blue-400 font-medium">Moderator</th>
                <th className="px-4 py-3 text-primary font-medium">Admin</th>
                <th className="px-4 py-3 text-purple-400 font-medium">Super Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ['View report queue',       true, true, true],
                ['Action / dismiss reports',true, true, true],
                ['Flag / hide videos',      true, true, true],
                ['Suspend users',           true, true, true],
                ['Delete videos',           false, true, true],
                ['View all users',          false, true, true],
                ['View analytics',          false, true, true],
                ['Change user roles',       false, false, true],
                ['Create team accounts',    false, false, true],
                ['Access settings',         false, true, true],
              ].map(([perm, mod, admin, superadmin]) => (
                <tr key={String(perm)}>
                  <td className="px-5 py-2.5 text-muted-foreground">{String(perm)}</td>
                  <td className="px-4 py-2.5 text-center">{mod ? '✓' : <span className="text-muted-foreground/30">—</span>}</td>
                  <td className="px-4 py-2.5 text-center">{admin ? '✓' : <span className="text-muted-foreground/30">—</span>}</td>
                  <td className="px-4 py-2.5 text-center">{superadmin ? '✓' : <span className="text-muted-foreground/30">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Env vars info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Environment Variables</h2>
        <p className="text-sm text-muted-foreground mb-4">Required in Vercel → Settings → Environment Variables</p>
        <div className="space-y-1.5 text-sm">
          {[
            ['MUX_TOKEN_ID', 'Mux video upload credentials'],
            ['MUX_TOKEN_SECRET', 'Mux video credentials'],
            ['MUX_WEBHOOK_SECRET', 'Mux webhook signature validation'],
            ['STRIPE_SECRET_KEY', 'Stripe server-side key'],
            ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook validation'],
            ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'Stripe client-side key'],
            ['NEXT_PUBLIC_STRIPE_PLATFORM_PRICE_ID', 'All-access subscription price ID'],
            ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role (never expose client-side)'],
          ].map(([key, desc]) => (
            <div key={String(key)} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <code className="text-xs bg-muted px-2 py-0.5 rounded">{String(key)}</code>
              <span className="text-xs text-muted-foreground ml-4 text-right">{String(desc)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
