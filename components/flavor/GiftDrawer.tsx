'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Gift, X, Zap } from 'lucide-react'
import Link from 'next/link'

const GIFTS = [
  { id: 'sauce_drop',     name: 'Sauce Drop',     emoji: '🫙',  cost: 5     },
  { id: 'chopsticks',     name: 'Chopsticks',     emoji: '🥢',  cost: 10    },
  { id: 'taco_pop',       name: 'Taco Pop',       emoji: '🌮',  cost: 25    },
  { id: 'ramen_bowl',     name: 'Ramen Bowl',     emoji: '🍜',  cost: 50    },
  { id: 'hapi_plate',     name: 'Hapi Plate',     emoji: '🍽️',  cost: 100   },
  { id: 'bento_box',      name: 'Bento Box',      emoji: '🍱',  cost: 250   },
  { id: 'hibachi_flame',  name: 'Hibachi Flame',  emoji: '🔥',  cost: 500   },
  { id: 'chef_hat',       name: 'Chef Hat',       emoji: '👨‍🍳',  cost: 1000  },
  { id: 'food_truck',     name: 'Food Truck',     emoji: '🚚',  cost: 5000  },
  { id: 'golden_spatula', name: 'Golden Spatula', emoji: '🥇',  cost: 10000 },
]

interface Props {
  streamId: string
  creatorId: string
  onGiftSent?: (gift: { name: string; emoji: string }) => void
}

export default function GiftDrawer({ streamId, creatorId, onGiftSent }: Props) {
  const [open, setOpen] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ gift: typeof GIFTS[0]; type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/flavor/wallet')
      .then(r => r.json())
      .then(d => setBalance(d.balance ?? 0))
      .catch(() => setBalance(0))
  }, [open])

  const handleGift = async (gift: typeof GIFTS[0]) => {
    if (balance !== null && balance < gift.cost) {
      setFlash({ gift, type: 'error', msg: 'Not enough Flavor Points' })
      setTimeout(() => setFlash(null), 2500)
      return
    }
    setLoading(gift.id)
    try {
      const res = await fetch('/api/flavor/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftId: gift.id, streamId, creatorId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setFlash({ gift, type: 'error', msg: json.error ?? 'Gift failed' })
        setTimeout(() => setFlash(null), 3000)
        return
      }
      setBalance(json.newBalance)
      setFlash({ gift, type: 'success', msg: `${gift.emoji} ${gift.name} sent!` })
      setTimeout(() => setFlash(null), 2500)
      onGiftSent?.({ name: gift.name, emoji: gift.emoji })
    } catch {
      setFlash({ gift, type: 'error', msg: 'Network error' })
      setTimeout(() => setFlash(null), 2500)
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      {/* Trigger button */}
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
        onClick={() => setOpen(true)}
      >
        <Gift className="h-4 w-4" />
        Send Gift
      </Button>

      {/* Drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Drawer panel */}
          <div className="relative w-full max-w-lg bg-background border-t border-x rounded-t-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Send a Gift 🎁</h3>
                {balance !== null && (
                  <p className="text-xs text-cyan-400">
                    🫙 {balance.toLocaleString()} pts available
                    <Link href="/flavor" className="ml-2 text-muted-foreground hover:text-cyan-400 underline">Top up</Link>
                  </p>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Flash message */}
            {flash && (
              <div className={`px-4 py-2 rounded-xl text-sm font-medium text-center ${
                flash.type === 'success'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}>
                {flash.msg}
                {flash.type === 'error' && flash.msg.includes('Not enough') && (
                  <Link href="/flavor" className="ml-2 underline text-cyan-400">Get more →</Link>
                )}
              </div>
            )}

            {/* Gift grid */}
            <div className="grid grid-cols-5 gap-2">
              {GIFTS.map(gift => {
                const canAfford = balance === null || balance >= gift.cost
                return (
                  <button
                    key={gift.id}
                    onClick={() => handleGift(gift)}
                    disabled={loading === gift.id || !canAfford}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all
                      ${loading === gift.id ? 'opacity-50 cursor-wait' : ''}
                      ${canAfford
                        ? 'hover:border-cyan-500/60 hover:bg-cyan-500/5 cursor-pointer'
                        : 'opacity-40 cursor-not-allowed'
                      }
                    `}
                    title={`${gift.name} — ${gift.cost.toLocaleString()} pts`}
                  >
                    <span className="text-2xl leading-none">{gift.emoji}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight line-clamp-1">{gift.name}</span>
                    <span className="text-[10px] font-bold text-cyan-400">{gift.cost >= 1000 ? `${gift.cost / 1000}k` : gift.cost}</span>
                  </button>
                )
              })}
            </div>

            {/* No balance CTA */}
            {balance === 0 && (
              <Link
                href="/flavor"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold text-sm hover:bg-cyan-500/20 transition-colors"
              >
                <Zap className="h-4 w-4" />
                Get Flavor Points to send gifts
              </Link>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              Creators receive 50% of gifted point value · Flavor Points have no cash value
            </p>
          </div>
        </div>
      )}
    </>
  )
}
