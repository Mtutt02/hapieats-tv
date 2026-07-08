'use client'

// ============================================================
// HapiEats TV Studio — Premium tier gating
// Free: single-layer editing, trim/split, text, filters, music.
// Premium: multi-track/PiP, keyframes, transitions, AI tools,
// watermark-free 1080p export.
// ============================================================

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { Crown, Sparkles, X } from 'lucide-react'
import Link from 'next/link'

export interface TierLimits {
  maxVideoTracks: number
  maxAudioTracks: number
  keyframes: boolean
  transitions: boolean
  ai: boolean
  watermark: boolean
  maxExportHeight: number
}

const FREE: TierLimits = {
  maxVideoTracks: 1,
  maxAudioTracks: 1,
  keyframes: false,
  transitions: false,
  ai: false,
  watermark: true,
  maxExportHeight: 720,
}

const PREMIUM: TierLimits = {
  maxVideoTracks: 6,
  maxAudioTracks: 4,
  keyframes: true,
  transitions: true,
  ai: true,
  watermark: false,
  maxExportHeight: 1080,
}

interface PremiumCtx {
  isPremium: boolean
  loading: boolean
  limits: TierLimits
  /** returns true if allowed; otherwise opens the upgrade modal */
  gate: (feature: string) => boolean
}

const Ctx = createContext<PremiumCtx>({ isPremium: false, loading: true, limits: FREE, gate: () => false })

export function usePremium() {
  return useContext(Ctx)
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/creator/monetization')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setIsPremium(Boolean(d?.isPremium)) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const gate = useCallback((feature: string) => {
    if (isPremium) return true
    setUpgradeFeature(feature)
    return false
  }, [isPremium])

  return (
    <Ctx.Provider value={{ isPremium, loading, limits: isPremium ? PREMIUM : FREE, gate }}>
      {children}
      {upgradeFeature && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setUpgradeFeature(null)}>
          <div
            className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-950 p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-500/10 border border-amber-500/40 flex items-center justify-center">
                <Crown className="h-6 w-6 text-amber-400" />
              </div>
              <button onClick={() => setUpgradeFeature(null)} className="text-zinc-500 hover:text-white" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="mt-4 text-xl font-bold text-white">{upgradeFeature} is a Studio Pro feature</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Unlock the full HapiEats TV Studio: multi-track editing, picture-in-picture,
              keyframe animation, transitions, AI captions, background removal, smart trim,
              and watermark-free 1080p exports.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-300">
              {['Unlimited video + audio layers', 'Keyframe animation & transitions', 'AI tools: captions, smart trim, background removal', '1080p export, no watermark'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3">
              <Link
                href="/tokens"
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-center text-sm font-bold text-black hover:opacity-90"
              >
                Upgrade now
              </Link>
              <Link
                href="/creator/chef-verification"
                className="flex-1 rounded-xl border border-zinc-700 px-4 py-2.5 text-center text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Become a creator
              </Link>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
