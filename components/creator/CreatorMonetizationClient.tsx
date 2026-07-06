'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, AlertCircle, ExternalLink, DollarSign, Users, TrendingUp } from 'lucide-react'

interface Channel {
  id: string
  name: string
  slug: string
  subscription_price: number | null
  stripe_price_id: string | null
}

interface Earnings {
  ppv: number
  subscriptions: number
  creatorShare: number
}

interface Props {
  hasConnectId: boolean
  channels: Channel[]
  earnings: Earnings
}

export default function CreatorMonetizationClient({ hasConnectId, channels, earnings }: Props) {
  const [connecting, setConnecting] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(channels.map(c => [c.id, c.subscription_price?.toString() ?? '']))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  const [connectError, setConnectError] = useState<string | null>(null)

  const handleConnect = async () => {
    setConnecting(true)
    setConnectError(null)
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setConnectError(json.error ?? 'Failed to connect Stripe'); return }
      if (json.url) window.location.href = json.url
    } catch {
      setConnectError('Network error — please try again')
    } finally {
      setConnecting(false)
    }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/connect/portal', { method: 'POST' })
    const { url } = await res.json()
    if (url) window.open(url, '_blank')
    setPortalLoading(false)
  }

  const handleSavePrice = async (channelId: string) => {
    const price = parseFloat(prices[channelId])
    if (isNaN(price) || price < 0.99) return

    setSaving(s => ({ ...s, [channelId]: true }))
    await fetch('/api/creator/subscription-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, priceUsd: price }),
    })
    setSaving(s => ({ ...s, [channelId]: false }))
    setSaved(s => ({ ...s, [channelId]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [channelId]: false })), 2500)
  }

  return (
    <div className="space-y-8">
      {/* Stripe Connect status */}
      <section className="p-6 rounded-2xl border bg-card">
        <h2 className="text-lg font-semibold mb-1">Stripe Payout Account</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Connect Stripe to receive direct payouts from subscriptions, PPV sales, and token gifts.
        </p>

        {hasConnectId ? (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" />
              Stripe account connected
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handlePortal}
              disabled={portalLoading}
            >
              <ExternalLink className="h-4 w-4" />
              {portalLoading ? 'Opening…' : 'Open Stripe Dashboard'}
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Stripe not connected</p>
              <p className="text-xs text-muted-foreground mb-3">You won't receive payouts until you connect Stripe.</p>
              {connectError && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-3">{connectError}</p>
              )}
              <Button onClick={handleConnect} disabled={connecting} className="gap-2">
                {connecting ? 'Redirecting…' : 'Connect Stripe Account'}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Earnings overview */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Earnings Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-4 w-4" />
              PPV Sales
            </div>
            <p className="text-2xl font-bold">${earnings.ppv.toFixed(2)}</p>
          </div>
          <div className="p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-4 w-4" />
              Subscriptions
            </div>
            <p className="text-2xl font-bold">${earnings.subscriptions.toFixed(2)}</p>
          </div>
          <div className="p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-4 w-4" />
              Your Share (80%)
            </div>
            <p className="text-2xl font-bold text-primary">${earnings.creatorShare.toFixed(2)}</p>
          </div>
        </div>
      </section>

      {/* Channel subscription pricing */}
      <section>
        <h2 className="text-lg font-semibold mb-1">Channel Subscription Prices</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Set a monthly price for each channel. Subscribers will pay this to access your subscription-only content.
        </p>

        {channels.length === 0 ? (
          <div className="p-4 rounded-xl border bg-muted/60 text-sm text-muted-foreground">
            You don't have any channels yet.{' '}
            <a href="/studio/channel/new" className="text-primary hover:underline">Create a channel</a> to set subscription pricing.
          </div>
        ) : (
          <div className="space-y-4">
            {channels.map(ch => (
              <div key={ch.id} className="p-4 rounded-xl border bg-card flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{ch.name}</p>
                  {ch.subscription_price ? (
                    <p className="text-xs text-muted-foreground">Current: ${ch.subscription_price}/month</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No subscription price set (content is free)</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      min="0.99"
                      step="0.01"
                      placeholder="4.99"
                      value={prices[ch.id]}
                      onChange={e => setPrices(p => ({ ...p, [ch.id]: e.target.value }))}
                      className="pl-7 w-28"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">/mo</span>
                  <Button
                    size="sm"
                    onClick={() => handleSavePrice(ch.id)}
                    disabled={saving[ch.id] || !prices[ch.id]}
                    variant={saved[ch.id] ? 'outline' : 'default'}
                  >
                    {saving[ch.id] ? 'Saving…' : saved[ch.id] ? '✓ Saved' : 'Set Price'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="p-4 rounded-xl bg-muted/60 text-sm text-muted-foreground">
        <strong>Payout schedule:</strong> Stripe transfers earnings to your bank account on a rolling 7-day basis after each transaction. HapiEats TV automatically deducts the 20% platform fee before transfer.
      </section>
    </div>
  )
}
