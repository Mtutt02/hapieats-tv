import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { sanitizeTheme } from '@/lib/academy/theme'
import ThemedShell from '@/components/academy/institution/ThemedShell'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { slug: string }
}

async function getSchool(slug: string) {
  const supabase = createServiceClient()
  const { data: inst } = await supabase
    .from('institutions')
    .select('*')
    .eq('slug', slug)
    .single()
  if (!inst) return null

  const [{ data: programs }, { data: courses }] = await Promise.all([
    supabase
      .from('programs')
      .select('id, title, slug, description, credential_tier, price')
      .eq('institution_id', inst.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('courses')
      .select('id, title, description, category, level, thumbnail_url, price_usd, price')
      .eq('institution_id', inst.id)
      .order('created_at', { ascending: false }),
  ])

  return { inst, programs: programs ?? [], courses: courses ?? [] }
}

export async function generateMetadata({ params }: PageProps) {
  const school = await getSchool(params.slug)
  if (!school) return { title: 'Culinary School' }
  const { inst } = school
  return {
    title: inst.name,
    description: inst.tagline || inst.about?.slice(0, 160) || `${inst.name} — culinary programs on HapiEats Academy`,
    openGraph: {
      title: inst.name,
      description: inst.tagline || undefined,
      images: inst.cover_url ? [inst.cover_url] : undefined,
    },
  }
}

function priceLabel(v: number | null | undefined) {
  const n = Number(v ?? 0)
  return n > 0 ? `$${n.toFixed(2)}` : 'Free'
}

export default async function SchoolMicrosite({ params }: PageProps) {
  const school = await getSchool(params.slug)
  if (!school) notFound()

  const { inst, programs, courses } = school
  const theme = sanitizeTheme(inst.theme)

  return (
    <ThemedShell theme={theme} className="min-h-screen bg-white text-slate-900">
      {/* Minimal school-branded top bar — no global HapiEats chrome */}
      <header className="flex items-center justify-between border-b bg-[var(--brand-primary)] px-5 py-3 text-white">
        <div className="flex items-center gap-3">
          {inst.logo_url ? (
            <Image src={inst.logo_url} alt={inst.name} width={36} height={36} className="rounded" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded bg-white/15 text-sm font-bold">
              {inst.name.slice(0, 1)}
            </div>
          )}
          <span className="text-lg font-semibold">{inst.name}</span>
        </div>
        {inst.is_verified && inst.accreditation_body && (
          <span className="rounded-full bg-[var(--brand-accent)] px-3 py-1 text-xs font-medium">
            Accredited · {inst.accreditation_body}
          </span>
        )}
      </header>

      {/* Cover / hero */}
      <section className="relative">
        <div className="relative h-56 w-full bg-slate-200 md:h-72">
          {inst.cover_url && (
            <Image src={inst.cover_url} alt={inst.name} fill className="object-cover" sizes="100vw" priority />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <div className="mx-auto max-w-5xl px-5 py-6">
          <h1 className="text-3xl font-bold text-[var(--brand-primary)]">{inst.name}</h1>
          {inst.tagline && <p className="mt-1 text-lg text-slate-600">{inst.tagline}</p>}
          {inst.about && <p className="mt-4 max-w-3xl whitespace-pre-line text-slate-700">{inst.about}</p>}
        </div>
      </section>

      {/* Programs */}
      {programs.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 pb-10">
          <h2 className="mb-4 text-2xl font-semibold text-[var(--brand-primary)]">Programs</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {programs.map((p) => (
              <Link
                key={p.id}
                href={`/academy/school/${inst.slug}/program/${p.id}`}
                className="group rounded-xl border p-5 transition-colors hover:border-[var(--brand-accent)]"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[var(--brand-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--brand-accent)]">
                    {p.credential_tier}
                  </span>
                  <span className="text-sm font-semibold">{priceLabel(p.price)}</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold group-hover:text-[var(--brand-accent)]">{p.title}</h3>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description}</p>}
                <span className="mt-3 inline-block text-sm font-medium text-[var(--brand-accent)]">View program →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Courses */}
      {courses.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 pb-16">
          <h2 className="mb-4 text-2xl font-semibold text-[var(--brand-primary)]">Individual Courses</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-xl border">
                <div className="relative aspect-video bg-slate-100">
                  {c.thumbnail_url && (
                    <Image src={c.thumbnail_url} alt={c.title} fill className="object-cover" sizes="33vw" />
                  )}
                </div>
                <div className="space-y-1 p-4">
                  <h3 className="font-semibold">{c.title}</h3>
                  {c.description && <p className="line-clamp-2 text-sm text-slate-600">{c.description}</p>}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs uppercase tracking-wide text-slate-400">{c.level}</span>
                    <span className="text-sm font-semibold">{priceLabel(c.price_usd ?? c.price)}</span>
                  </div>
                  <Link
                    href={`/learn/${c.id}`}
                    className="mt-2 block rounded-md bg-[var(--brand-accent)] px-3 py-2 text-center text-sm font-medium text-white"
                  >
                    Enroll
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {programs.length === 0 && courses.length === 0 && (
        <section className="mx-auto max-w-5xl px-5 py-16 text-center text-slate-500">
          This school hasn&apos;t published any programs or courses yet.
        </section>
      )}

      <footer className="border-t px-5 py-6 text-center text-xs text-slate-400">
        {inst.name} · Powered by HapiEats Academy
      </footer>
    </ThemedShell>
  )
}
