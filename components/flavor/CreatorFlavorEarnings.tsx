'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { TrendingUp, DollarSign, Clock, CheckCircle2 } from 'lucide-react'

interface CashoutData {
  pendingPoints: number
  usdGross: number
  platformFeePct: number
  platformFeeUsd: number
  usdNet: number
  minPoints: number
  canCashout: boolean
  history: Array<{
    id: string
    points_total: number
    usd_gross: number
    platform_fee_usd: number
    usd_net: number
    status: string
    created_at: string
    processed_at: string | null
  }>
}

export default function CreatorFlavorEarnings() {
  const [data, setData] = useState<CashoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/flavor/cashout')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCashout = async () => {
    if (!data?.canCashout) return
    setRequesting(true)
    setResult(null)
    try {
      const res = await fetch('/api/flavor/cashout', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setResult({ success: true, message: json.message })
        load() // Refresh data
      } else {
        setResult({ success: false, message: json.error ?? 'Request failed' })
      }
    } catch {
      setResult({ success: false, message: 'Network error — please try again' })
    } finally {
      setRequesting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 rounded-2xl border bg-card animate-pulse h-48" />
    )
  }

  if (!data) return null

  const feePercent = Math.round((data.platformFeePct ?? 0.05) * 100)

  return (
    <div className="space-y-6">
      {/* Earnings overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <TrendingUp className="h-4 w-4" />
            Pending Points
          </div>
          <p className="text-2xl font-bold text-cyan-400">{data.pendingPoints.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Flavor Points earned</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <DollarSign className="h-4 w-4" />
            Gross Value
          </div>
          <p className="text-2xl font-bold">${data.usdGross.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Before {feePercent}% platform fee</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <DollarSign className="h-4 w-4 text-green-500" />
            Your Payout
          </div>
          <p className="text-2xl font-bold text-green-500">${data.usdNet.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">After ${data.platformFeeUsd.toFixed(2)} fee</p>
        </div>
      </div>

      {/* Cashout section */}
      <div className="p-5 rounded-2xl border bg-card space-y-4">
        <h3 className="font-semibold">Cash Out Earnings</h3>

        {result && (
          <div className={`p-3 rounded-xl text-sm ${
            result.success
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}>
            {result.message}
          </div>
        )}

        {/* Fee breakdown */}
        {data.pendingPoints > 0 && (
          <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Points to cash out</span>
              <span className="font-medium">{data.pendingPoints.toLocaleString()} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross value</span>
              <span>${data.usdGross.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-orange-400">
              <span>Platform fee ({feePercent}%)</span>
              <span>−${data.platformFeeUsd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-2">
              <span>You receive</span>
              <span className="text-green-400">${data.usdNet.toFixed(2)}</span>
            </div>
          </div>
        )}

        {!data.canCashout ? (
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-xl p-4">
            Minimum cashout is <strong>{data.minPoints.toLocaleString()} Flavor Points</strong> (≈${(data.minPoints * 0.0099).toFixed(2)} gross).
            You have <strong>{data.pendingPoints.toLocaleString()} pts</strong> — need {(data.minPoints - data.pendingPoints).toLocaleString()} more.
          </div>
        ) : (
          <Button
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold"
            onClick={handleCashout}
            disabled={requesting}
          >
            {requesting ? 'Submitting…' : `Request Payout — $${data.usdNet.toFixed(2)}`}
          </Button>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Payouts processed within 5–7 business days via Stripe Connect. {feePercent}% platform fee deducted automatically.
        </p>
      </div>

      {/* Cashout history */}
      {data.history.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Cashout History</h3>
          <div className="rounded-xl border overflow-hidden">
            {data.history.map(req => (
              <div key={req.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 text-sm">
                <div className="flex items-center gap-2">
                  {req.status === 'paid'
                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                    : <Clock className="h-4 w-4 text-muted-foreground" />
                  }
                  <div>
                    <p className="font-medium">${Number(req.usd_net).toFixed(2)} payout</p>
                    <p className="text-xs text-muted-foreground">
                      {req.points_total.toLocaleString()} pts · ${Number(req.platform_fee_usd).toFixed(2)} fee
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    req.status === 'paid'    ? 'bg-green-500/10 text-green-400' :
                    req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                    req.status === 'approved'? 'bg-cyan-500/10 text-cyan-400' :
                    'bg-destructive/10 text-destructive'
                  }`}>{req.status}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
