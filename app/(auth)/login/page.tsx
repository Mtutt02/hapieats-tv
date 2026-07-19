'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [magicSent, setMagicSent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect') ?? '/'
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/'
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    // Sign in server-side so a username (not just an email) can be used without
    // leaking account emails to the client.
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      setError(data.error ?? 'Invalid login credentials')
      setLoading(false)
      return
    }
    if (redirect === '/' && ['superadmin', 'admin', 'moderator'].includes(data.role)) {
      router.push('/admin')
      router.refresh()
      return
    }
    router.push(redirect)
    router.refresh()
  }

  // Magic link — email the user a one-time sign-in link that lands on /auth/callback
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { setError('Enter your email first'); return }
    if (!email.includes('@')) { setError('Enter your email address (not a username) to get a magic link'); return }
    setLoading(true)
    setError(null)
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo, shouldCreateUser: true },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setMagicSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-baseline gap-0">
            <span className="font-black text-2xl text-cyan-400">HAPI</span>
            <span className="font-black text-2xl text-white">EATS</span>
            <span className="font-black text-2xl text-pink-500 italic ml-1">TV</span>
          </Link>
          <p className="text-muted-foreground text-sm mt-2">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          {magicSent ? (
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">✉️</div>
              <p className="text-sm font-semibold text-foreground">Check your email</p>
              <p className="text-sm text-muted-foreground">
                We sent a magic sign-in link to <span className="font-medium text-foreground">{email}</span>. Tap it to log in — no password needed.
              </p>
              <button
                type="button"
                onClick={() => { setMagicSent(false); setMode('password') }}
                className="text-xs text-primary hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={mode === 'magic' ? handleMagicLink : handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">{mode === 'magic' ? 'Email' : 'Email or username'}</Label>
                <Input
                  id="email"
                  type={mode === 'magic' ? 'email' : 'text'}
                  autoComplete={mode === 'magic' ? 'email' : 'username'}
                  placeholder={mode === 'magic' ? 'you@example.com' : 'you@example.com or username'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {mode === 'password' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (mode === 'magic' ? 'Sending link…' : 'Signing in…') : (mode === 'magic' ? 'Email me a login link' : 'Sign in')}
              </Button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-2 text-[11px] text-muted-foreground">or</span></div>
              </div>

              <button
                type="button"
                onClick={() => { setMode(mode === 'magic' ? 'password' : 'magic'); setError(null) }}
                className="w-full text-sm text-primary hover:underline"
              >
                {mode === 'magic' ? 'Sign in with a password instead' : '✨ Sign in with a magic link (no password)'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
