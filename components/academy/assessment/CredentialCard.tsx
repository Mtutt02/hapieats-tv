'use client'

import { Award, ShieldCheck, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { CredentialTier } from '@/lib/academy/types'
import { verifyUrl } from '@/lib/academy/types'

export interface CredentialCardData {
  title: string
  tier: CredentialTier
  serial: string
  verificationCode: string
  accreditationPartner?: string | null
  issuer?: string | null
  holder?: string | null
  issuedAt?: string | null
  revoked?: boolean
}

const TIER_LABEL: Record<CredentialTier, string> = {
  completion: 'Certificate of Completion',
  skill: 'Skill Credential',
  diploma: 'Professional Diploma',
}

const TIER_ACCENT: Record<CredentialTier, string> = {
  completion: 'from-neutral-700 to-neutral-900',
  skill: 'from-orange-500 to-amber-600',
  diploma: 'from-indigo-600 to-purple-700',
}

// Verifiable credential — distinct from a plain course Certificate. Highlights the
// tier, accreditation partner, and the public verify code.
export default function CredentialCard({ credential }: { credential: CredentialCardData }) {
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(credential.verificationCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className={`bg-gradient-to-r ${TIER_ACCENT[credential.tier]} px-6 py-5 text-white`}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <Award className="h-4 w-4" />
            {TIER_LABEL[credential.tier]}
          </span>
          {credential.revoked ? (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold">Revoked</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verifiable
            </span>
          )}
        </div>
        <h3 className="mt-3 text-2xl font-bold leading-tight">{credential.title}</h3>
        {credential.holder ? (
          <p className="mt-1 text-sm text-white/90">Awarded to {credential.holder}</p>
        ) : null}
      </div>

      <div className="space-y-4 px-6 py-5">
        {credential.accreditationPartner ? (
          <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
            <span className="text-neutral-500">Accreditation partner</span>
            <p className="font-semibold text-neutral-900">{credential.accreditationPartner}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-neutral-500">Issuer</span>
            <p className="font-medium text-neutral-900">{credential.issuer || 'HapiEats Academy'}</p>
          </div>
          {credential.issuedAt ? (
            <div>
              <span className="text-neutral-500">Issued</span>
              <p className="font-medium text-neutral-900">
                {new Date(credential.issuedAt).toLocaleDateString()}
              </p>
            </div>
          ) : null}
        </div>

        <div className="text-sm">
          <span className="text-neutral-500">Serial</span>
          <p className="font-mono text-neutral-900">{credential.serial}</p>
        </div>

        <div className="rounded-lg border border-dashed border-neutral-300 p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-neutral-500">Verification code</span>
              <p className="font-mono text-lg font-bold tracking-wider text-neutral-900">
                {credential.verificationCode}
              </p>
            </div>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <a
            href={verifyUrl(credential.verificationCode)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-medium text-orange-600 hover:underline"
          >
            Verify at {verifyUrl(credential.verificationCode)}
          </a>
        </div>
      </div>
    </div>
  )
}
