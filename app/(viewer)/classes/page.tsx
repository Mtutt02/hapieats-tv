import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import ClassCard from '@/components/classes/ClassCard'
import Link from 'next/link'
import { GraduationCap, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Class } from '@/types'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Cooking Classes',
  description: 'Learn from expert chefs and home cooks. Browse live and recorded cooking classes on HapiEats TV.',
}

interface PageProps {
  searchParams: { type?: string; category?: string; skill?: string }
}

const categories = [
  { value: '', label: 'All' },
  { value: 'baking', label: 'Baking' },
  { value: 'cooking', label: 'Cooking' },
  { value: 'pastry', label: 'Pastry' },
  { value: 'grilling', label: 'Grilling' },
  { value: 'international', label: 'International' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'nutrition', label: 'Nutrition' },
]

const types = [
  { value: '', label: 'All' },
  { value: 'live', label: 'Live Classes' },
  { value: 'recorded', label: 'Recorded' },
  { value: 'series', label: 'Series' },
]

const skills = [
  { value: '', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

function buildParams(current: Record<string, string | undefined>, update: Record<string, string>) {
  const params = new URLSearchParams()
  const merged = { ...current, ...update }
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v)
  }
  return params.toString() ? `?${params.toString()}` : ''
}

export default async function ClassesPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const { type, category, skill } = searchParams

  // Base query for published classes
  let query = supabase
    .from('classes')
    .select(`
      *,
      instructor:profiles(id, username, display_name, avatar_url),
      channel:channels(id, name, slug, thumbnail_url)
    `)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (type) query = query.eq('type', type)
  if (category) query = query.eq('category', category)
  if (skill) query = query.eq('skill_level', skill)

  const { data: classes } = await query.limit(48)

  // Featured: live classes happening soon (next 48h)
  const now = new Date()
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  const { data: featuredLive } = await supabase
    .from('classes')
    .select(`
      *,
      instructor:profiles(id, username, display_name, avatar_url),
      channel:channels(id, name, slug, thumbnail_url)
    `)
    .eq('is_published', true)
    .eq('type', 'live')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', in48h.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(4)

  const currentParams = { type, category, skill }

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Cooking Classes</h1>
          </div>
          <p className="text-muted-foreground text-lg">Learn from expert chefs and home cooks</p>
        </div>

        {/* Featured live section */}
        {featuredLive && featuredLive.length > 0 && !type && !category && !skill && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-red-500" />
              <h2 className="text-xl font-semibold">Upcoming Live Classes</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(featuredLive as Class[]).map((cls) => (
                <ClassCard key={cls.id} class={cls} />
              ))}
            </div>
          </section>
        )}

        {/* Filters */}
        <div className="space-y-3 mb-8">
          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat.value}
                href={`/classes${buildParams(currentParams, { category: cat.value })}`}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  (category ?? '') === cat.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                )}
              >
                {cat.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Type filter */}
            <div className="flex gap-2">
              {types.map((t) => (
                <Link
                  key={t.value}
                  href={`/classes${buildParams(currentParams, { type: t.value })}`}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    (type ?? '') === t.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </div>

            {/* Skill filter */}
            <div className="flex gap-2">
              {skills.map((s) => (
                <Link
                  key={s.value}
                  href={`/classes${buildParams(currentParams, { skill: s.value })}`}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    (skill ?? '') === s.value
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Classes grid */}
        {classes && classes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(classes as Class[]).map((cls) => (
              <ClassCard key={cls.id} class={cls} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No classes found</h3>
            <p className="text-muted-foreground">
              {type || category || skill
                ? 'Try adjusting your filters to find more classes.'
                : 'Check back soon — new classes are being added all the time.'}
            </p>
          </div>
        )}
      </main>
    </AppShell>
  )
}
