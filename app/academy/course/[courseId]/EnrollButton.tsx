'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PricingModel } from '@/lib/academy/types'

/**
 * EnrollButton — drives POST /api/academy/courses/[id]/enroll and reflects
 * the course pricing_model. On a free / pro / token enroll we route into the
 * classroom; a paid Stripe enroll redirects to the returned checkoutUrl.
 */
export default function EnrollButton({
  courseId,
  pricingModel,
  proIncluded,
  price,
  signedIn,
}: {
  courseId: string
  pricingModel: PricingModel
  proIncluded: boolean
  price: number
  signedIn: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enroll(method?: 'tokens' | 'stripe') {
    if (!signedIn) {
      router.push(`/login?next=/academy/course/${courseId}`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/academy/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method ? { method } : {}),
      })
      const data = await res.json().catch(() => ({}))

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }
      if (data?.requiresPro) {
        router.push('/academy?pro=1')
        return
      }
      if (!res.ok) {
        setError(data?.error ?? 'Could not enroll — please try again.')
        return
      }
      if (data?.enrolled) {
        router.push(`/academy/course/${courseId}/learn`)
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  const label =
    pricingModel === 'free'
      ? 'Enroll free'
      : pricingModel === 'pro_only'
        ? 'Start with Pro'
        : proIncluded
          ? `Buy $${price.toFixed(2)}`
          : `Enroll · $${price.toFixed(2)}`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => enroll(pricingModel === 'paid' ? 'stripe' : undefined)}
          disabled={loading}
          className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? 'Please wait…' : label}
        </button>

        {pricingModel === 'paid' && proIncluded && (
          <button
            type="button"
            onClick={() => router.push('/academy?pro=1')}
            disabled={loading}
            className="rounded-md border border-emerald-600 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-950/50 disabled:opacity-60"
          >
            Go Pro
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
