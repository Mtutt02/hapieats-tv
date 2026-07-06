'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface EnrollButtonProps {
  classId: string
  price: number
  isEnrolled: boolean
  userId: string | null
}

export default function EnrollButton({ classId, price, isEnrolled, userId }: EnrollButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [enrolled, setEnrolled] = useState(isEnrolled)

  const handleEnroll = async () => {
    if (!userId) {
      router.push(`/login?redirect=/classes/${classId}`)
      return
    }

    if (price > 0) {
      setLoading(true)
      try {
        const res = await fetch(`/api/classes/${classId}/enroll/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            successUrl: `${window.location.origin}/classes/${classId}?enrolled=1`,
            cancelUrl: window.location.href,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.url) throw new Error(data.error ?? 'Checkout failed')
        window.location.href = data.url
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/classes/${classId}/enroll`, {
        method: 'POST',
      })
      if (res.ok) {
        setEnrolled(true)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Failed to enroll. Please try again.')
      }
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (enrolled) {
    return (
      <Button className="w-full gap-2" disabled variant="secondary">
        <CheckCircle className="h-4 w-4 text-green-500" />
        Enrolled
      </Button>
    )
  }

  return (
    <Button className="w-full gap-2" onClick={handleEnroll} disabled={loading}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {price === 0 ? 'Enroll for Free' : `Enroll for ${formatCurrency(price)}`}
    </Button>
  )
}
