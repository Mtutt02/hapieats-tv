'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * "Continue with Munchor" — signs in with a Munchor account, the same ways
 * Munchor's own login offers:
 *
 *   • Password — with the Munchor email OR username
 *   • Email code — the 6-digit code from Munchor's sign-in email
 *   • Text code — the 6-digit code Munchor texts to the account's phone
 *
 * Munchor runs on its own backend, so everything goes to our server, which
 * verifies it with Munchor and maps the result onto a HapiEats account.
 * Nothing the user types is stored by HapiEats.
 */

type Method = 'password' | 'email' | 'phone'

const METHODS: { id: Method; label: string }[] = [
  { id: 'password', label: 'Password' },
  { id: 'email', label: 'Email code' },
  { id: 'phone', label: 'Text code' },
]

export default function MunchorSignIn({ redirect = '/' }: { redirect?: string }) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<Method>('password')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
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

  const switchMethod = (m: Method) => {
    setMethod(m)
    setError(null)
    setCode('')
    setCodeSent(false)
  }

  const sendCode = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/munchor/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method === 'phone' ? { phone } : { email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not send a code')
        return
      }
      setCode('')
      setCodeSent(true)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const signIn = async () => {
    setLoading(true)
    setError(null)
    const payload =
      method === 'password'
        ? { method: 'password', identifier, password, next: redirect }
        : method === 'email'
          ? { method: 'code', email, code, next: redirect }
          : { method: 'code', phone, code, next: redirect }

    try {
      const res = await fetch('/api/auth/munchor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'Could not sign in with Munchor')
        return
      }

      if (data.status === 'confirmation_required') {
        setConfirmSentTo(data.email ?? identifier)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (method !== 'password' && !codeSent) void sendCode()
    else void signIn()
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
            setCode('')
            setCodeSent(false)
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

  const destination = method === 'phone' ? phone : email

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

      <div
        role="tablist"
        aria-label="How do you sign in to Munchor?"
        className="grid grid-cols-3 gap-1 rounded-lg bg-background p-1 border border-border"
      >
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={method === m.id}
            onClick={() => switchMethod(m.id)}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              method === m.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {method === 'password' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="munchor-identifier">Munchor email or username</Label>
            <Input
              id="munchor-identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com or @username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
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
        </>
      )}

      {method === 'email' && !codeSent && (
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
      )}

      {method === 'phone' && !codeSent && (
        <div className="space-y-1.5">
          <Label htmlFor="munchor-phone">Phone number on your Munchor account</Label>
          <Input
            id="munchor-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="(555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
      )}

      {method !== 'password' && codeSent && (
        <div className="space-y-1.5">
          <Label htmlFor="munchor-code">
            {method === 'phone' ? 'Code from your text' : 'Code from your email'}
          </Label>
          <Input
            id="munchor-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            required
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Sent to <span className="font-medium text-foreground">{destination}</span>
            {method === 'email' && ' — type the 6-digit code here; the link in that email opens Munchor, not HapiEats TV'}
            .{' '}
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={loading}
              className="text-primary hover:underline disabled:opacity-50"
            >
              Send a new code
            </button>
            {' · '}
            <button
              type="button"
              onClick={() => { setCodeSent(false); setCode(''); setError(null) }}
              className="text-primary hover:underline"
            >
              Change {method === 'phone' ? 'number' : 'email'}
            </button>
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? method !== 'password' && !codeSent
            ? 'Sending code…'
            : 'Checking with Munchor…'
          : method !== 'password' && !codeSent
            ? method === 'phone' ? 'Text me a code' : 'Email me a code'
            : 'Continue'}
      </Button>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        We check your details with Munchor to confirm it&apos;s you. HapiEats TV never saves your
        Munchor password or codes.
      </p>
    </form>
  )
}
