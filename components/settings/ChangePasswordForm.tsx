'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

/**
 * Self-contained "change your password" form.
 *
 * Posts to PATCH /api/user/password with the current + new password. The
 * current password is verified server-side (re-authentication) before the
 * change is applied, so an open session alone can't reset the password.
 *
 * Used by both the general settings page and the creator dashboard settings.
 */
export default function ChangePasswordForm() {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!currentPw) { setMsg({ ok: false, text: 'Enter your current password' }); return }
    if (newPw !== confirmPw) { setMsg({ ok: false, text: 'New passwords do not match' }); return }
    if (newPw.length < 8) { setMsg({ ok: false, text: 'Password must be at least 8 characters' }); return }
    if (newPw === currentPw) { setMsg({ ok: false, text: 'New password must be different from your current one' }); return }

    setLoading(true)
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setMsg({ ok: true, text: 'Password updated successfully' })
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
      } else {
        setMsg({ ok: false, text: data.error ?? 'Failed to update password' })
      }
    } catch {
      setMsg({ ok: false, text: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="currentPw">Current Password</Label>
        <Input
          id="currentPw"
          type="password"
          value={currentPw}
          onChange={e => setCurrentPw(e.target.value)}
          className="mt-1.5"
          autoComplete="current-password"
        />
      </div>
      <div>
        <Label htmlFor="newPw">New Password</Label>
        <Input
          id="newPw"
          type="password"
          value={newPw}
          onChange={e => setNewPw(e.target.value)}
          className="mt-1.5"
          autoComplete="new-password"
        />
      </div>
      <div>
        <Label htmlFor="confirmPw">Confirm New Password</Label>
        <Input
          id="confirmPw"
          type="password"
          value={confirmPw}
          onChange={e => setConfirmPw(e.target.value)}
          className="mt-1.5"
          autoComplete="new-password"
        />
      </div>

      {msg && (
        <div className={`flex items-center gap-2 text-sm ${msg.ok ? 'text-green-500' : 'text-destructive'}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? 'Updating…' : 'Update Password'}
      </Button>
    </form>
  )
}
