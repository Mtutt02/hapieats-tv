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

/** Munchor's mark: navy tile, fuchsia→violet "M". */
function MunchorMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="munchor-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E91E8C" />
          <stop offset="1" stopColor="#8B3DFF" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill="#1B2559" />
      <path
        d="M6.5 17V7.5l5.5 6 5.5-6V17"
        fill="none"
        stroke="url(#munchor-mark-g)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** HapiEats TV ⇄ Munchor, joined by a flowing link — "one account, both apps". */
function LinkGraphic() {
  return (
    <svg viewBox="0 0 176 44" className="h-11 w-44" role="img" aria-label="HapiEats TV linked with Munchor">
      <defs>
        <linearGradient id="munchor-link-tv" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="munchor-link-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.5" stopColor="#E91E8C" />
          <stop offset="1" stopColor="#8B3DFF" />
        </linearGradient>
        <linearGradient id="munchor-link-m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E91E8C" />
          <stop offset="1" stopColor="#8B3DFF" />
        </linearGradient>
      </defs>
      {/* HapiEats TV */}
      <rect x="2" y="4" width="36" height="36" rx="11" fill="url(#munchor-link-tv)" />
      <text x="20" y="27" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif">
        TV
      </text>
      {/* the link */}
      <path
        d="M44 22 C 70 6, 106 38, 132 22"
        fill="none"
        stroke="url(#munchor-link-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="6 6"
        className="animate-munchor-flow motion-reduce:animate-none"
      />
      <circle cx="88" cy="22" r="4" fill="#E91E8C" className="animate-pulse motion-reduce:animate-none" />
      {/* Munchor */}
      <rect x="138" y="4" width="36" height="36" rx="11" fill="#1B2559" />
      <path
        d="M147 30V15l9 9.5 9-9.5v15"
        fill="none"
        stroke="url(#munchor-link-m)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function MunchorSignIn({
  redirect = '/',
  onOpenChange,
}: {
  redirect?: string
  /** Lets the page hide its own sign-in fields while this panel is open. */
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpenState] = useState(false)
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

  const setOpen = (value: boolean) => {
    setOpenState(value)
    onOpenChange?.(value)
  }

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
        className="group relative block w-full rounded-lg p-[1.5px] bg-[linear-gradient(110deg,#E91E8C,#8B3DFF,#22D3EE,#E91E8C)] bg-[length:200%_100%] hover:animate-munchor-sheen motion-reduce:hover:animate-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex items-center justify-center gap-2 rounded-[calc(var(--radius)-1.5px)] bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors group-hover:bg-card/80">
          <MunchorMark />
          Continue with Munchor
        </span>
      </button>
    )
  }

  const destination = method === 'phone' ? phone : email

  const methodIndex = METHODS.findIndex((m) => m.id === method)

  return (
    <form
      onSubmit={handleSubmit}
      className="relative space-y-4 overflow-hidden rounded-xl border border-border bg-muted/30 p-4 animate-munchor-in motion-reduce:animate-none"
    >
      {/* soft Munchor glow behind the header */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(233,30,140,0.35),rgba(139,61,255,0.2),transparent)] blur-2xl"
      />

      <div className="relative flex items-start justify-between">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Other options
        </button>
      </div>

      <div className="relative flex flex-col items-center gap-1.5 text-center">
        <LinkGraphic />
        <p className="text-sm font-semibold text-foreground">Sign in with Munchor</p>
        <p className="text-[11px] text-muted-foreground">One account for Munchor and HapiEats TV</p>
      </div>

      <div
        role="tablist"
        aria-label="How do you sign in to Munchor?"
        className="relative grid grid-cols-3 rounded-lg border border-border bg-background p-1"
      >
        {/* sliding selection pill */}
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-[linear-gradient(110deg,#E91E8C,#8B3DFF)] shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${methodIndex * 100}%)` }}
        />
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={method === m.id}
            onClick={() => switchMethod(m.id)}
            className={`relative z-10 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              method === m.id ? 'text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div
        key={`${method}-${codeSent ? 'code' : 'start'}`}
        className="space-y-4 animate-munchor-step motion-reduce:animate-none"
      >
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

      </div>

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
