'use client'

import { useState } from 'react'
import { Coins, Zap, Star, Crown, Gift, Check, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

interface TokenPack {
  id: string
  name: string
  description: string | null
  token_amount: number
  bonus_tokens: number
  price_cents: number
  sort_order: number
}

interface HapiWallet {
  user_id: string
  balance: number
  lifetime_purchased: number
  lifetime_spent: number
  lifetime_gifted: number
}

interface LiveGift {
  id: string
  name: string
  emoji: string
  token_cost: number
  display_priority: number
}

const PACK_ICONS = [Coins, Zap, Star, Crown, Gift]
const PACK_COLORS = [
  'border-blue-500/40 hover:border-blue-500/70',
  'border-primary/40 hover:border-primary/70',
  'border-purple-500/40 hover:border-purple-500/70',
  'border-pink-500/40 hover:border-pink-500/70',
  'border-yellow-500/40 hover:border-yellow-500/70',
]
const PACK_ICON_COLORS = ['text-blue-400', 'text-primary', 'text-purple-400', 'text-pink-400', 'text-yellow-400']

interface Props {
  packs: TokenPack[]
  wallet: HapiWallet
  gifts: LiveGift[]
}

export default function TokenStoreClient({ packs, wallet: initialWallet, gifts }: Props) {
  const [wallet, setWallet] = useState(initialWallet)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [purchased, setPurchased] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('purchased') === '1') {
      setPurchased(true)
      const tokens = parseInt(searchParams.get('tokens') ?? '0')
      if (tokens > 0) setWallet(w => ({ ...w, balance: w.balance + tokens }))
      // Clean up URL
      const url = new URL(window.location.href)
      url.searchParams.delete('purchased')
      url.searchParams.delete('tokens')
      router.replace(url.pathname)
    }
  }, [searchParams, router])

  async function buyPack(pack: TokenPack) {
    setLoading(pack.id)
    setError(null)
    try {
      const res = await fetch('/api/tokens/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_id: pack.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Purchase failed')
      if (data.url) window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-8">

      {/* Header + Balance */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            Hapi Tokens
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Send gifts to creators during live streams, vote in challenges, and fund creator goals.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-3 text-center">
          <div className="text-2xl font-bold text-primary">{wallet.balance.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Your Balance</div>
        </div>
      </div>

      {/* Success banner */}
      {purchased && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400">
          <Check className="h-4 w-4 shrink-0" />
          Tokens added to your wallet!
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Token packs grid */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-4">Buy Tokens</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packs.map((pack, i) => {
            const Icon = PACK_ICONS[i % PACK_ICONS.length]
            const borderColor = PACK_COLORS[i % PACK_COLORS.length]
            const iconColor = PACK_ICON_COLORS[i % PACK_ICON_COLORS.length]
            const totalTokens = pack.token_amount + pack.bonus_tokens
            const priceStr = `$${(pack.price_cents / 100).toFixed(2)}`
            const isLoading = loading === pack.id

            return (
              <button
                key={pack.id}
                onClick={() => buyPack(pack)}
                disabled={!!loading}
                className={`relative bg-card border ${borderColor} rounded-xl p-5 text-left transition-all duration-200 hover:bg-muted/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {pack.bonus_tokens > 0 && (
                  <div className="absolute top-3 right-3 text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                    +{pack.bonus_tokens} bonus
                  </div>
                )}
                <div className={`${iconColor} mb-3`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-lg font-bold">{totalTokens.toLocaleString()} Tokens</div>
                <div className="text-sm text-muted-foreground mt-0.5">{pack.name}</div>
                <div className="mt-3 text-xl font-black text-foreground">{priceStr}</div>
                {pack.price_cents > 0 && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {((pack.price_cents / 100) / totalTokens * 100).toFixed(1)}¢ per 100 tokens
                  </div>
                )}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* What you can do with tokens */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-4">What are Hapi Tokens for?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: '🎁', title: 'Live Gifts', desc: 'Send animated gifts to creators during live streams. 70% goes directly to the creator.' },
            { icon: '🏆', title: 'Challenge Voting', desc: 'Use tokens to cast premium votes in creator challenges — each token = one vote.' },
            { icon: '🎯', title: 'Creator Goals', desc: 'Contribute tokens to fan-funded goals and help your favorite creators reach their dreams.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-4">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="font-semibold text-sm mb-1">{title}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Live gifts preview */}
      {gifts.length > 0 && (
        <section className="mb-10">
          <h2 className="text-base font-semibold mb-4">Available Gifts</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {gifts.map(gift => (
              <div key={gift.id} className="bg-card border border-border rounded-xl p-3 text-center">
                <div className="text-3xl mb-1">{gift.emoji}</div>
                <div className="text-xs font-semibold">{gift.name}</div>
                <div className="text-xs text-primary mt-0.5 font-mono">{gift.token_cost} tokens</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lifetime stats */}
      {(wallet.lifetime_purchased > 0) && (
        <section>
          <h2 className="text-base font-semibold mb-4">Your Token History</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-border">
              {[
                { label: 'Purchased', value: wallet.lifetime_purchased },
                { label: 'Spent', value: wallet.lifetime_spent },
                { label: 'Gifted', value: wallet.lifetime_gifted },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 text-center">
                  <div className="text-xl font-bold text-primary">{value.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Token policy note */}
      <p className="mt-8 text-xs text-muted-foreground text-center">
        Hapi Tokens are non-refundable virtual currency. 70% of gift value goes to creators, 20% to the platform, and 10% to the Creator Circle Pool.
      </p>
    </div>
  )
}
