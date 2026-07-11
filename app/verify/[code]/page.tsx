import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  // Verification pages should never be indexed.
  return {
    title: 'Certificate Verification — HapiEats Academy',
    robots: { index: false, follow: false },
  }
}

const TIER_LABEL: Record<string, string> = {
  completion: 'Completion',
  skill: 'Skill Mastery',
  diploma: 'Diploma',
}

interface Resolved {
  kind: 'course' | 'credential'
  holderName: string
  title: string
  tier: string
  serial: string
  issuedAt: string
  revoked: boolean
}

async function lookup(code: string): Promise<Resolved | null> {
  const service = createServiceClient()

  // 1) Course certificates
  const { data: cert } = await service
    .from('course_certificates')
    .select('user_id, course_id, tier, serial, issued_at, revoked')
    .eq('verification_code', code)
    .maybeSingle()

  if (cert) {
    const [{ data: profile }, { data: course }] = await Promise.all([
      service.from('profiles').select('display_name, username').eq('id', cert.user_id).maybeSingle(),
      service.from('courses').select('title').eq('id', cert.course_id).maybeSingle(),
    ])
    return {
      kind: 'course',
      holderName: profile?.display_name || profile?.username || 'HapiEats Learner',
      title: course?.title || 'HapiEats Academy Course',
      tier: cert.tier,
      serial: cert.serial,
      issuedAt: cert.issued_at,
      revoked: cert.revoked === true,
    }
  }

  // 2) Program / accredited credentials
  const { data: cred } = await service
    .from('credentials')
    .select('user_id, title, tier, serial, issued_at, revoked')
    .eq('verification_code', code)
    .maybeSingle()

  if (cred) {
    const { data: profile } = await service
      .from('profiles')
      .select('display_name, username')
      .eq('id', cred.user_id)
      .maybeSingle()
    return {
      kind: 'credential',
      holderName: profile?.display_name || profile?.username || 'HapiEats Learner',
      title: cred.title || 'HapiEats Academy Credential',
      tier: cred.tier,
      serial: cred.serial,
      issuedAt: cred.issued_at,
      revoked: cred.revoked === true,
    }
  }

  return null
}

export default async function VerifyPage({ params }: { params: { code: string } }) {
  const record = await lookup(params.code)

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-16 text-neutral-100">
      <div className="w-full max-w-lg">
        {!record ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800 text-2xl">
              ?
            </div>
            <h1 className="text-xl font-bold">Certificate not found</h1>
            <p className="mt-2 text-sm text-neutral-400">
              No HapiEats Academy certificate matches the code
              <span className="mx-1 font-mono text-neutral-200">{params.code}</span>.
              Please double-check the verification code.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            {/* Status banner */}
            <div
              className={
                'flex items-center gap-3 px-6 py-4 ' +
                (record.revoked ? 'bg-red-950/60' : 'bg-emerald-950/60')
              }
            >
              <div
                className={
                  'flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold ' +
                  (record.revoked ? 'bg-red-600 text-white' : 'bg-emerald-500 text-neutral-950')
                }
              >
                {record.revoked ? '×' : '✓'}
              </div>
              <div>
                <div className="text-sm font-semibold">
                  {record.revoked ? 'Certificate revoked' : 'Verified certificate'}
                </div>
                <div className="text-xs text-neutral-400">
                  {record.revoked
                    ? 'This credential is no longer valid.'
                    : 'This credential is authentic and issued by HapiEats Academy.'}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-5 px-6 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-600 bg-amber-900 text-sm font-black text-amber-50">
                  HE
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400/80">
                  HapiEats Academy
                </div>
              </div>

              <Field label="Awarded to" value={record.holderName} big />
              <Field
                label={record.kind === 'course' ? 'Course' : 'Program'}
                value={record.title}
              />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Type" value={`Certificate of ${TIER_LABEL[record.tier] ?? 'Completion'}`} />
                <Field
                  label="Issued"
                  value={new Date(record.issuedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                />
              </div>
              <Field label="Serial" value={record.serial} mono />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function Field({
  label,
  value,
  big,
  mono,
}: {
  label: string
  value: string
  big?: boolean
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</div>
      <div
        className={
          (big ? 'text-lg font-bold ' : 'text-sm font-medium ') +
          (mono ? 'font-mono text-neutral-300 ' : 'text-neutral-100 ')
        }
      >
        {value}
      </div>
    </div>
  )
}
