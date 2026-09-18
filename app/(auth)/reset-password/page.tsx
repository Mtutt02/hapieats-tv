'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/layout/Logo'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // The recovery link routes through /auth/callback, which establishes a
  // session before landing here. If there's no session, the link was expired,
  // already used, or opened directly — tell the user plainly.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
    })
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center">
            <Logo size={28} />
            <span className="flex items-baseline gap-0 leading-none">
              <span className="font-black text-xl tracking-tight text-cyan-400">HAPI</span>
              <span className="font-black text-xl tracking-tight text-white">EATS</span>
              <span className="font-black text-xl tracking-tight text-pink-500 italic ml-1">TV</span>
            </span>
          </Link>
          <p className="text-muted-foreground mt-2">Set a new password</p>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          {done ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">✅</div>
              <h2 className="font-semibold">Password updated!</h2>
              <p className="text-sm text-muted-foreground">Redirecting you home…</p>
            </div>
          ) : hasSession === false ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">⚠️</div>
              <h2 className="font-semibold text-lg">This link isn&apos;t valid</h2>
              <p className="text-sm text-muted-foreground">
                Your password reset link has expired or was already used. Request a new one and it&apos;ll work right away.
              </p>
              <Link href="/forgot-password" className="inline-block py-2.5 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition">
                Send a new reset link
              </Link>
            </div>
          ) : hasSession === null ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Verifying your link…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">New password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium mb-1.5">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
