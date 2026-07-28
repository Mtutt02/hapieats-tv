'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Radio, Check, Zap, BarChart2, Headphones, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

const FEATURES = [
  { icon: Radio,      text: 'Go live anytime — browser-based, no software needed' },
  { icon: Zap,        text: 'Low-latency WHIP streaming via Mux' },
  { icon: Check,      text: 'Receive Flavor Point gifts from viewers during streams' },
  { icon: BarChart2,  text: 'Advanced creator analytics & viewer insights' },
  { icon: Headphones, text: 'Priority support from the HapiEats TV team' },
  { icon: Check,      text: 'Creator Pro badge on your profile' },
]

export default function CreatorProUpgradeWall() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpgrade = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'platform_subscription',
          successUrl: `${window.location.origin}/studio/go-live?upgraded=1`,
          cancelUrl: `${window.location.origin}/studio/go-live`,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? 'Failed to start checkout')
      }
      window.location.href = json.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8 text-center">
        {/* Lock icon */}
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Lock className="h-8 w-8 text-red-400" />
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Live streaming requires <span className="text-red-400">Creator Pro</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Upgrade your account to broadcast live and earn Flavor Point gifts from viewers in real time.
          </p>
        </div>

        {/* Pricing card */}
        <div className="rounded-2xl border border-red-500/30 bg-red-950/10 p-6 text-left space-y-5">
          <div className="flex items-end gap-1">
            <span className="text-4xl font-black text-white">$14.99</span>
            <span className="text-muted-foreground text-sm mb-1">/month</span>
          </div>
          <p className="text-xs text-muted-foreground -mt-3">Cancel anytime. No long-term commitment.</p>

          <ul className="space-y-2.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm">
                <span className="h-5 w-5 shrink-0 mt-0.5 text-red-400">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-zinc-300">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold h-12 text-base"
          >
            {loading ? 'Redirecting to checkout…' : 'Upgrade to Creator Pro →'}
          </Button>
          <Link
            href="/dashboard"
            className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to dashboard
          </Link>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Secure checkout via Stripe. You'll be redirected back after payment.
        </p>
      </div>
    </div>
  )
}
