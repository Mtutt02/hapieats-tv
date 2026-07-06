'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'

const BUNDLES = [
  { id: 'starter', tokens: 100, priceUsd: 1.99, label: 'Starter', tag: null },
  { id: 'popular', tokens: 500, priceUsd: 7.99, label: 'Popular', tag: 'Best Value' },
  { id: 'mega', tokens: 1200, priceUsd: 14.99, label: 'Mega', tag: '+20% Bonus' },
  { id: 'ultra', tokens: 3000, priceUsd: 29.99, label: 'Ultra', tag: '+50% Bonus' },
]

export default function TokenShopClient() {
  const [loading, setLoading] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const handleBuy = async (bundleId: string) => {
    setLoading(bundleId)
    setGlobalError(null)
    try {
      const res = await fetch('/api/tokens/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle: bundleId,
          successUrl: `${window.location.origin}/tokens?success=1`,
          cancelUrl: `${window.location.origin}/tokens`,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setGlobalError(json.error ?? 'Purchase failed'); return }
      if (json.url) window.location.href = json.url
    } catch {
      setGlobalError('Network error — please try again')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {globalError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <strong>Error:</strong> {globalError}
          {globalError.includes('not configured') && (
            <p className="mt-1 text-xs text-muted-foreground">
              To enable token purchases, add <code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> and <code className="bg-muted px-1 rounded">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to your Vercel environment variables.
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {BUNDLES.map(b => (
          <div
            key={b.id}
            className="relative p-5 rounded-2xl border bg-card flex flex-col items-center gap-3"
          >
            {b.tag && (
              <span className="absolute -top-2 right-4 text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
                {b.tag}
              </span>
            )}
            <div className="text-4xl font-bold text-yellow-400 flex items-center gap-1.5">
              🪙 {b.tokens.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">{b.label} bundle</p>
            <div className="text-xl font-bold">${b.priceUsd.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ≈ ${(b.priceUsd / b.tokens * 100).toFixed(1)}¢ per 100 tokens
            </p>
            <Button
              className="w-full gap-2"
              onClick={() => handleBuy(b.id)}
              disabled={loading === b.id}
            >
              <Zap className="h-4 w-4" />
              {loading === b.id ? 'Redirecting…' : `Buy ${b.tokens.toLocaleString()} Tokens`}
            </Button>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-muted/60 text-sm text-muted-foreground text-center">
        Tokens are non-refundable. Creators receive <strong>70%</strong> of the token value when you gift them.
        HapiEats TV retains 30% to cover platform operations.
      </div>
    </div>
  )
}
