'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'

const PACKAGES = [
  { id: 'starter_bite', name: 'Starter Bite',  points: 100,   priceUsd: 0.99,  tag: null,           emoji: '🍿' },
  { id: 'snack_pack',   name: 'Snack Pack',    points: 520,   priceUsd: 4.99,  tag: null,           emoji: '🍟' },
  { id: 'full_plate',   name: 'Full Plate',    points: 1100,  priceUsd: 9.99,  tag: 'Most Popular', emoji: '🍽️' },
  { id: 'family_meal',  name: 'Family Meal',   points: 2850,  priceUsd: 24.99, tag: '+14% Bonus',   emoji: '🥘' },
  { id: 'feast_pack',   name: 'Feast Pack',    points: 6000,  priceUsd: 49.99, tag: '+20% Bonus',   emoji: '🎉' },
  { id: 'vip_table',    name: 'VIP Table',     points: 12500, priceUsd: 99.99, tag: '+25% Bonus',   emoji: '👑' },
]

interface Props {
  initialBalance?: number
}

export default function FlavorShop({ initialBalance = 0 }: Props) {
  const [balance, setBalance] = useState(initialBalance)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [purchases, setPurchases] = useState<{ package_id: string; points_credited: number; amount_usd: number; created_at: string }[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    fetch('/api/flavor/wallet')
      .then(r => r.json())
      .then(d => {
        setBalance(d.balance ?? 0)
        setPurchases(d.purchases ?? [])
      })
      .catch(() => {})
  }, [])

  const handleBuy = async (packageId: string) => {
    setLoading(packageId)
    setError(null)
    try {
      const res = await fetch('/api/flavor/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          successUrl: `${window.location.origin}/flavor?success=1`,
          cancelUrl: `${window.location.origin}/flavor`,
        }),
      })
      // Safe parse — server may return HTML on 500/504 instead of JSON
      const json = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (!res.ok) {
        setError(json.error ?? `Error ${res.status} — please try again`)
        return
      }
      if (json.url) window.location.href = json.url
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Balance chip */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold text-lg">
          🫙 {balance.toLocaleString()} Flavor Points
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <strong>Error:</strong> {error}
          {error.includes('not configured') && (
            <p className="mt-1 text-xs text-muted-foreground">
              Add <code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> and <code className="bg-muted px-1 rounded">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to your Vercel environment variables.
            </p>
          )}
        </div>
      )}

      {/* Package grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PACKAGES.map(pkg => (
          <div
            key={pkg.id}
            className="relative p-5 rounded-2xl border bg-card flex flex-col items-center gap-3 hover:border-cyan-500/40 transition-colors"
          >
            {pkg.tag && (
              <span className="absolute -top-2.5 right-4 text-[10px] font-bold bg-cyan-500 text-black px-2 py-0.5 rounded-full tracking-wide">
                {pkg.tag}
              </span>
            )}
            <div className="text-4xl">{pkg.emoji}</div>
            <p className="font-bold text-base">{pkg.name}</p>
            <div className="text-3xl font-extrabold text-cyan-400">
              {pkg.points.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Flavor Points</p>
            <div className="text-xl font-bold">${pkg.priceUsd.toFixed(2)}</div>
            <p className="text-[11px] text-muted-foreground">
              ${((pkg.priceUsd / pkg.points) * 100).toFixed(2)}¢ per 100 pts
            </p>
            <Button
              className="w-full gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
              onClick={() => handleBuy(pkg.id)}
              disabled={loading === pkg.id}
            >
              <Zap className="h-4 w-4" />
              {loading === pkg.id ? 'Redirecting…' : `Buy ${pkg.points.toLocaleString()} pts`}
            </Button>
          </div>
        ))}
      </div>

      {/* Legal */}
      <div className="p-4 rounded-xl bg-muted/60 text-xs text-muted-foreground text-center space-y-1">
        <p>Flavor Points have <strong>no cash value</strong> and are non-refundable except where required by law.</p>
        <p>Must be 18+ to purchase. Creators receive <strong>50%</strong> of gifted point value. HapiEats TV retains 50%.</p>
      </div>

      {/* Purchase history toggle */}
      {purchases.length > 0 && (
        <div>
          <button
            className="text-sm text-cyan-400 hover:underline"
            onClick={() => setShowHistory(h => !h)}
          >
            {showHistory ? 'Hide' : 'Show'} purchase history ({purchases.length})
          </button>
          {showHistory && (
            <div className="mt-3 rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Package</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Points</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Paid</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2 capitalize">{p.package_id.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-right text-cyan-400 font-medium">+{p.points_credited.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">${Number(p.amount_usd).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
