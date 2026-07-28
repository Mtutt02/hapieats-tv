'use client'

import { useState, useEffect } from 'react'
import { Crown, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface PremiumGateProps {
  feature: string
  description: string
  children: React.ReactNode
}

export default function PremiumGate({ feature, description, children }: PremiumGateProps) {
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/creator/monetization')
        if (res.ok) {
          const data = await res.json()
          setIsPremium(Boolean(data.isPremium ?? (data.isCreator || data.hasCredits)))
        }
      } catch {
        // If API doesn't exist yet, default to not premium
        setIsPremium(false)
      }
      setLoading(false)
    }
    check()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-pulse h-32 w-full max-w-md rounded-2xl bg-zinc-800" />
      </div>
    )
  }

  if (!isPremium) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
          <Crown className="h-7 w-7 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{feature}</h3>
          <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">{description}</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/creator/chef-verification"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <Sparkles className="h-4 w-4" /> Unlock Premium
          </Link>
          <Link
            href="/credits"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors"
          >
            Buy Credits
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
