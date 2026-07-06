'use client'

import { useState } from 'react'
import { Bot, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'

interface ScanResult {
  scanned: number
  flagged: number
  categories?: string[]
}

export default function AIScanButton({ onComplete }: { onComplete?: (result: ScanResult) => void }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runScan() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const resp = await fetch('/api/admin/ai-moderate', { method: 'POST' })
      const data: ScanResult & { error?: string } = await resp.json()

      if (!resp.ok) throw new Error(data.error ?? 'Scan failed')

      setResult(data)
      onComplete?.(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={runScan}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" />Scanning…</>
            : <><Bot className="h-4 w-4" />Run AI Patrol</>}
        </button>

        {result && !loading && (
          <button
            onClick={runScan}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Scan again"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      {result && (
        <div className={`flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl border ${
          result.flagged > 0
            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
            : 'bg-green-500/10 text-green-400 border-green-500/20'
        }`}>
          {result.flagged > 0
            ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          <span>
            Scanned <strong>{result.scanned}</strong> items.{' '}
            {result.flagged > 0
              ? <><strong>{result.flagged}</strong> flagged — {result.categories?.join(', ')}</>
              : 'No violations found.'}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
