'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * "Continue with Munchor" — signs in with a Munchor account.
 *
 * Munchor runs on its own backend, so the credentials go to our server, which
 * verifies them against Munchor and maps the result onto a HapiEats account.
 * The password is never stored and never touches the HapiEats database.
 */
export default function MunchorSignIn({ redirect = '/' }: { redirect?: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null)
  // null = still checking. Keeps the button hidden until we know Munchor is
  // actually wired up, rather than offering a control that 503s.
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    let active = true
    fetch('/api/auth/munchor/status')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => active && setEnabled(Boolean(d.enabled)))
      .catch(() => active && setEnabled(false))
    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/munchor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next: redirect }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'Could not sign in with Munchor')
        return
      }

      if (data.status === 'confirmation_required') {
        setConfirmSentTo(data.email ?? email)
        return
      }

      // Session cookies are set by the route; refresh so the server sees them.
      router.replace(redirect)
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (!enabled) return null

  if (confirmSentTo) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-center space-y-2">
        <p className="text-2xl" aria-hidden="true">📬</p>
        <p className="text-sm font-medium text-foreground">Check your email</p>
        <p className="text-sm text-muted-foreground">
          A HapiEats TV account already uses{' '}
          <span className="font-medium text-foreground">{confirmSentTo}</span>. We sent a link
          there — open it to connect your Munchor account. The link expires in 30 minutes.
        </p>
        <button
          type="button"
          onClick={() => {
            setConfirmSentTo(null)
            setPassword('')
          }}
          className="text-sm text-primary hover:underline"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span aria-hidden="true">🍔</span>
        Continue with Munchor
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Sign in with Munchor</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="munchor-email">Munchor email</Label>
        <Input
          id="munchor-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="munchor-password">Munchor password</Label>
        <Input
          id="munchor-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Checking with Munchor…' : 'Continue'}
      </Button>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        We check your details with Munchor to confirm it&apos;s you. Your Munchor password is never
        saved by HapiEats TV.
      </p>
    </form>
  )
}
