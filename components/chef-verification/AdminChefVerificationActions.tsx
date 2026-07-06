'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface Props {
  applicationId: string
  applicantName: string
}

export default function AdminChefVerificationActions({ applicationId, applicantName }: Props) {
  const router = useRouter()
  const [denyOpen, setDenyOpen] = useState(false)
  const [denialReason, setDenialReason] = useState('')
  const [loading, setLoading] = useState<'approve' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAction = async (action: 'approve' | 'deny') => {
    setError(null)

    if (action === 'deny') {
      if (!denyOpen) {
        setDenyOpen(true)
        return
      }
      if (!denialReason.trim()) {
        setError('Please enter a reason for denial.')
        return
      }
    }

    setLoading(action)
    try {
      const res = await fetch('/api/admin/chef-verification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          action,
          ...(action === 'deny' ? { denialReason: denialReason.trim() } : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        setLoading(null)
        return
      }

      // Refresh the page to reflect the updated list
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* Approve */}
        <Button
          size="sm"
          onClick={() => handleAction('approve')}
          disabled={loading !== null || denyOpen}
          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
        >
          {loading === 'approve' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Approve
        </Button>

        {/* Deny */}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleAction('deny')}
          disabled={loading !== null}
          className="gap-1.5"
        >
          {loading === 'deny' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {denyOpen ? 'Confirm Deny' : 'Deny'}
        </Button>

        {denyOpen && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setDenyOpen(false); setDenialReason(''); setError(null) }}
            disabled={loading !== null}
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Denial reason input */}
      {denyOpen && (
        <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
          <Label htmlFor={`denial-${applicationId}`} className="text-xs">
            Reason for denial (sent to {applicantName})
          </Label>
          <Textarea
            id={`denial-${applicationId}`}
            value={denialReason}
            onChange={(e) => setDenialReason(e.target.value)}
            placeholder="e.g. Unable to verify credentials provided. Please reapply with documentation..."
            className="min-h-[72px] text-sm resize-none"
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
