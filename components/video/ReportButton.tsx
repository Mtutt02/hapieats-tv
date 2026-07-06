'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Flag, X } from 'lucide-react'

const REPORT_REASONS = [
  'Sexual or explicit content',
  'Hate speech or discrimination',
  'Spam or misleading',
  'Violence or dangerous acts',
  'Harassment or bullying',
  'Copyright violation',
  'Misinformation',
  'Other',
]

interface Props {
  /** The DB id of the item being reported */
  targetId: string
  /** What kind of content is being reported */
  type: 'video' | 'comment' | 'post'
  userId: string | null
  /** Compact icon-only mode for inline use (comments, cards) */
  compact?: boolean
}

export default function ReportButton({ targetId, type, userId, compact = false }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const label =
    type === 'comment' ? 'Report comment'
    : type === 'post' ? 'Report post'
    : 'Report video'

  const handleSubmit = async () => {
    if (!selected) return
    if (!userId) { window.location.href = '/login'; return }

    setLoading(true)
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, type, reason: selected, detail }),
    })
    setLoading(false)
    setSubmitted(true)
    setTimeout(() => { setOpen(false); setSubmitted(false); setSelected(''); setDetail('') }, 2000)
  }

  return (
    <div className="relative">
      {compact ? (
        <button
          onClick={() => setOpen(o => !o)}
          title={label}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <Flag className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(o => !o)}
          title={label}
        >
          <Flag className="h-4 w-4" />
          <span className="text-xs">Report</span>
        </Button>
      )}

      {open && (
        <div className="absolute right-0 top-7 z-50 w-72 bg-popover border border-border rounded-xl shadow-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm">{label}</p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {submitted ? (
            <p className="text-sm text-green-500 text-center py-2">Report submitted — thank you.</p>
          ) : (
            <>
              <div className="space-y-1 mb-3">
                {REPORT_REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setSelected(r)}
                    className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                      selected === r ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {selected && (
                <textarea
                  placeholder="Additional details (optional)"
                  value={detail}
                  onChange={e => setDetail(e.target.value)}
                  rows={2}
                  className="w-full text-sm bg-muted/60 border border-border rounded-lg px-3 py-2 mb-3 resize-none focus:outline-none focus:ring-2 ring-primary/40"
                />
              )}
              <Button
                onClick={handleSubmit}
                disabled={!selected || loading}
                className="w-full"
                size="sm"
              >
                {loading ? 'Submitting…' : 'Submit Report'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
