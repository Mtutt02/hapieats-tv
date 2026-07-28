'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * CompletionCard — shown when every non-preview lesson is complete.
 * Requests a certificate from POST /api/academy/courses/[id]/certificate,
 * then links to the public verification page /verify/[code].
 */
export default function CompletionCard({
  courseId,
  issuesCertificate,
  existingCode,
}: {
  courseId: string
  issuesCertificate: boolean
  existingCode?: string | null
}) {
  const [code, setCode] = useState<string | null>(existingCode ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function getCertificate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/academy/courses/${courseId}/certificate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Could not issue certificate yet.')
        return
      }
      setCode(data?.certificate?.verification_code ?? null)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl text-black">
        ✓
      </div>
      <h3 className="text-lg font-semibold text-emerald-100">Course complete!</h3>
      <p className="mt-1 text-sm text-emerald-200/80">
        You&apos;ve finished every lesson. Nice work in the kitchen.
      </p>

      {code ? (
        <Link
          href={`/verify/${code}`}
          className="mt-4 inline-block rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          View your certificate
        </Link>
      ) : issuesCertificate ? (
        <button
          type="button"
          onClick={getCertificate}
          disabled={loading}
          className="mt-4 inline-block rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? 'Issuing…' : 'Get your certificate'}
        </button>
      ) : null}

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  )
}
