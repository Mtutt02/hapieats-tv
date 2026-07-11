'use client'

/**
 * Certificate — a printable 16:9 presentational certificate card.
 * Pure presentation: pass the resolved fields in. Dark + parchment styling,
 * HapiEats crest, and a Print button that calls window.print().
 */

import { verifyUrl } from '@/lib/academy/types'

export interface CertificateProps {
  holderName: string
  courseTitle: string
  tier: 'completion' | 'skill' | 'diploma' | string
  serial: string
  verificationCode: string
  issuedAt: string // ISO
  issuer?: string
}

const TIER_LABEL: Record<string, string> = {
  completion: 'Completion',
  skill: 'Skill Mastery',
  diploma: 'Diploma',
}

export default function Certificate({
  holderName,
  courseTitle,
  tier,
  serial,
  verificationCode,
  issuedAt,
  issuer = 'HapiEats Academy',
}: CertificateProps) {
  const tierLabel = TIER_LABEL[tier] ?? 'Completion'
  const dateStr = new Date(issuedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const url = verifyUrl(verificationCode)

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Certificate card — 16:9 */}
      <div
        className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border-4 border-amber-700/40 shadow-2xl print:shadow-none"
        style={{ background: 'linear-gradient(135deg, #faf5e6 0%, #f1e7cc 100%)' }}
      >
        {/* Inner gold frame */}
        <div className="absolute inset-3 rounded-lg border border-amber-800/30" />
        <div className="absolute inset-4 rounded-lg border border-amber-800/20" />

        <div className="relative flex h-full flex-col items-center justify-between px-6 py-6 text-center text-amber-950 sm:px-10 sm:py-8">
          {/* Crest */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-700 bg-amber-900 text-xl font-black text-amber-50 shadow-md">
              HE
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-800/80">
              {issuer}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs font-medium uppercase tracking-[0.35em] text-amber-700/70">
              Certificate of {tierLabel}
            </div>
            <div className="mt-2 text-[11px] uppercase tracking-widest text-amber-800/60">
              This certifies that
            </div>
            <div className="font-serif text-3xl font-bold text-amber-950 sm:text-4xl">
              {holderName}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-widest text-amber-800/60">
              has successfully completed
            </div>
            <div className="max-w-xl font-serif text-lg font-semibold text-amber-900 sm:text-xl">
              {courseTitle}
            </div>
          </div>

          {/* Footer meta */}
          <div className="flex w-full items-end justify-between gap-4 text-left">
            <div className="text-[10px] leading-tight text-amber-800/80">
              <div className="font-semibold uppercase tracking-wider">Issued</div>
              <div>{dateStr}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full border-2 border-amber-700 bg-amber-100/60" aria-hidden />
              <div className="mt-0.5 text-[8px] uppercase tracking-widest text-amber-800/70">Seal</div>
            </div>
            <div className="text-right text-[10px] leading-tight text-amber-800/80">
              <div className="font-semibold uppercase tracking-wider">Serial</div>
              <div className="font-mono">{serial}</div>
              <div className="mt-1 font-semibold uppercase tracking-wider">Verify</div>
              <div className="font-mono">{url}</div>
              <div className="font-mono text-amber-900">Code: {verificationCode}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Print button — hidden when printing */}
      <div className="mt-4 flex justify-center print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-amber-700 px-5 py-2 text-sm font-semibold text-amber-50 shadow transition hover:bg-amber-800"
        >
          Print certificate
        </button>
      </div>
    </div>
  )
}
