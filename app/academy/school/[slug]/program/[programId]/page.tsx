import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { sanitizeTheme } from '@/lib/academy/theme'
import ThemedShell from '@/components/academy/institution/ThemedShell'
import ProgramEnrollButton from '@/components/academy/institution/ProgramEnrollButton'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { slug: string; programId: string }
}

const TIER_BLURB: Record<string, string> = {
  completion: 'A Certificate of Completion recognizing that you finished every course in this track.',
  skill: 'A verifiable Skill Credential attesting to the practical competencies covered.',
  diploma: 'An accredited Diploma — the school\'s highest credential for this program.',
}

async function getData(slug: string, programId: string) {
  const supabase = createServiceClient()
  const { data: inst } = await supabase
    .from('institutions')
    .select('*')
    .eq('slug', slug)
    .single()
  if (!inst) return null

  const { data: program } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .eq('institution_id', inst.id)
    .single()
  if (!program) return null

  const { data: links } = await supabase
    .from('program_courses')
    .select('course_id, order_index')
    .eq('program_id', program.id)
    .order('order_index', { ascending: true })

  const ids = (links ?? []).map((l) => l.course_id)
  let courses: any[] = []
  if (ids.length) {
    const { data: cs } = await supabase
      .from('courses')
      .select('id, title, description, level, estimated_minutes, thumbnail_url')
      .in('id', ids)
    const byId = new Map((cs ?? []).map((c) => [c.id, c]))
    courses = (links ?? []).map((l) => byId.get(l.course_id)).filter(Boolean)
  }

  return { inst, program, courses }
}

export async function generateMetadata({ params }: PageProps) {
  const data = await getData(params.slug, params.programId)
  if (!data) return { title: 'Program' }
  return {
    title: `${data.program.title} · ${data.inst.name}`,
    description: data.program.description?.slice(0, 160) || undefined,
  }
}

export default async function ProgramPage({ params }: PageProps) {
  const data = await getData(params.slug, params.programId)
  if (!data) notFound()

  const { inst, program, courses } = data
  const theme = sanitizeTheme(inst.theme)
  const price = Number(program.price ?? 0)

  return (
    <ThemedShell theme={theme} className="min-h-screen bg-white text-slate-900">
      <header className="flex items-center gap-3 border-b bg-[var(--brand-primary)] px-5 py-3 text-white">
        {inst.logo_url ? (
          <Image src={inst.logo_url} alt={inst.name} width={32} height={32} className="rounded" />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded bg-white/15 text-sm font-bold">
            {inst.name.slice(0, 1)}
          </div>
        )}
        <Link href={`/academy/school/${inst.slug}`} className="text-base font-semibold hover:underline">
          {inst.name}
        </Link>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <span className="rounded-full bg-[var(--brand-accent)]/10 px-3 py-1 text-xs font-medium text-[var(--brand-accent)]">
          {program.credential_tier} credential
        </span>
        <h1 className="mt-3 text-3xl font-bold text-[var(--brand-primary)]">{program.title}</h1>
        {program.description && (
          <p className="mt-3 whitespace-pre-line text-slate-700">{program.description}</p>
        )}

        {/* Enroll CTA */}
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border p-5">
          <div>
            <div className="text-2xl font-bold text-[var(--brand-primary)]">
              {price > 0 ? `$${price.toFixed(2)}` : 'Free'}
            </div>
            <div className="text-sm text-slate-500">{courses.length} course{courses.length === 1 ? '' : 's'}</div>
          </div>
          <div className="ml-auto">
            <ProgramEnrollButton programId={program.id} isFree={price <= 0} />
          </div>
        </div>

        {/* What you earn */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-[var(--brand-primary)]">What you&apos;ll earn</h2>
          <p className="mt-2 text-slate-700">{TIER_BLURB[program.credential_tier] ?? TIER_BLURB.skill}</p>
          {inst.is_verified && inst.accreditation_body && (
            <p className="mt-2 text-sm text-slate-500">Accredited by {inst.accreditation_body}.</p>
          )}
        </section>

        {/* Curriculum */}
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold text-[var(--brand-primary)]">Curriculum</h2>
          <ol className="space-y-3">
            {courses.length === 0 && (
              <li className="rounded-md border border-dashed p-4 text-sm text-slate-500">
                Curriculum coming soon.
              </li>
            )}
            {courses.map((c, i) => (
              <li key={c.id} className="flex gap-4 rounded-xl border p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand-primary)] text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">{c.title}</h3>
                  {c.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.description}</p>}
                  <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                    {c.level}
                    {c.estimated_minutes ? ` · ~${c.estimated_minutes} min` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="border-t px-5 py-6 text-center text-xs text-slate-400">
        {inst.name} · Powered by HapiEats Academy
      </footer>
    </ThemedShell>
  )
}
