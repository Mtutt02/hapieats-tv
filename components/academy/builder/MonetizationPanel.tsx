'use client'

import { Sparkles } from 'lucide-react'
import type { PricingModel } from '@/lib/academy/types'
import { CLASS_CREATOR_PCT, PRO_POOL_PCT } from '@/lib/academy/types'

export interface MonetizationValue {
  pricing_model: PricingModel
  price: number
  pro_included: boolean
}

export default function MonetizationPanel({
  value,
  onChange,
}: {
  value: MonetizationValue
  onChange: (v: MonetizationValue) => void
}) {
  const set = (patch: Partial<MonetizationValue>) => onChange({ ...value, ...patch })

  const models: { key: PricingModel; label: string; hint: string }[] = [
    { key: 'free', label: 'Free', hint: 'Anyone can enroll' },
    { key: 'paid', label: 'Paid', hint: 'One-time purchase' },
    { key: 'pro_only', label: 'Pro only', hint: 'Requires HapiEats Pro' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-zinc-200 mb-2">Pricing model</p>
        <div className="grid grid-cols-3 gap-2">
          {models.map((m) => (
            <button
              type="button"
              key={m.key}
              onClick={() => set({ pricing_model: m.key, price: m.key === 'paid' ? value.price || 29 : 0 })}
              className={
                'rounded-lg border p-3 text-left transition-colors ' +
                (value.pricing_model === m.key
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700')
              }
            >
              <p className="text-sm font-medium text-zinc-100">{m.label}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{m.hint}</p>
            </button>
          ))}
        </div>
      </div>

      {value.pricing_model === 'paid' && (
        <div>
          <label className="text-sm font-medium text-zinc-200 mb-1 block">Price (USD)</label>
          <div className="relative w-40">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
            <input
              type="number"
              min={0}
              step="1"
              value={value.price}
              onChange={(e) => set({ price: Number(e.target.value) })}
              className="w-full pl-7 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            You keep {Math.round(CLASS_CREATOR_PCT * 100)}% of each direct sale.
          </p>
        </div>
      )}

      <label className="flex items-start gap-3 rounded-lg border border-indigo-500/40 bg-indigo-500/5 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={value.pro_included}
          onChange={(e) => set({ pro_included: e.target.checked })}
          className="mt-1 h-4 w-4 accent-indigo-500"
        />
        <div>
          <p className="text-sm font-medium text-zinc-100 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Include in HapiEats Pro
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Two payout rails: direct sales pay you {Math.round(CLASS_CREATOR_PCT * 100)}% up front, and every
            Pro member who watches this course earns you a share of the {Math.round(PRO_POOL_PCT * 100)}% all-access
            pool based on completed watch time.
          </p>
        </div>
      </label>
    </div>
  )
}
