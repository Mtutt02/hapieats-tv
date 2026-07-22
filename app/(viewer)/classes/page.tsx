import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import Link from 'next/link'
import Image from 'next/image'
import { GraduationCap, BookOpen, Users, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Cooking Classes',
  description: 'Learn from expert chefs and home cooks. Browse live, recorded, and hybrid cooking classes on HapiEats TV.',
}

interface PageProps {
  searchParams: { type?: string; category?: string; level?: string }
}

// Filters map onto the unified course backend:
//   type  → courses.format   (recorded | live | hybrid)
//   level → courses.level     (beginner | intermediate | advanced | professional)
//   category → courses.category
const types = [
  { value: '', label: 'All' },
  { value: 'recorded', label: 'Recorded' },
  { value: 'live', label: 'Live' },
  { value: 'hybrid', label: 'Live + Recorded' },
]

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

const levels = [
  { value: '', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'professional', label: 'Pro' },
]

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-red-500/20 text-red-400',
  professional: 'bg-indigo-500/20 text-indigo-300',
}

function buildParams(current: Record<string, string | undefined>, update: Record<string, string>) {
  const params = new URLSearchParams()
  const merged = { ...current, ...update }
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v)
  }
  return params.toString() ? `?${params.toString()}` : ''
}

function formatDuration(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default async function ClassesPage({ searchParams }: PageProps) {
  const supabase = createServiceClient()
  const { type, category, level } = searchParams

  let query = supabase
    .from('courses')
    .select(`
      id, title, description, thumbnail_url, pricing_model, price_usd,
      lesson_count, enrollment_count, total_duration_seconds, level, category, format,
      creator:profiles!creator_id(id, username, display_name, avatar_url)
    `)
    .eq('status', 'published')
    .order('enrollment_count', { ascending: false })

  if (type) query = query.eq('format', type)
  if (category) query = query.eq('category', category)
  if (level) query = query.eq('level', level)

  const { data: classes } = await query.limit(48)
  const currentParams = { type, category, level }

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <GraduationCap className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Cooking Classes</h1>
            </div>
            <p className="text-muted-foreground text-lg">Learn from expert chefs and home cooks</p>
          </div>
          <Link
            href="/academy"
            className="hidden sm:flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            + Teach a Class
          </Link>
        </div>

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
            <div className="flex flex-wrap gap-2">
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

            {/* Level filter */}
            <div className="flex flex-wrap gap-2">
              {levels.map((s) => (
                <Link
                  key={s.value}
                  href={`/classes${buildParams(currentParams, { level: s.value })}`}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    (level ?? '') === s.value
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
            {classes.map((cls) => {
              const creator = cls.creator as { username: string; display_name: string | null; avatar_url: string | null } | null
              return (
                <Link
                  key={cls.id}
                  href={`/academy/course/${cls.id}`}
                  className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted">
                    {cls.thumbnail_url ? (
                      <Image
                        src={cls.thumbnail_url}
                        alt={cls.title}
                        fill
                        className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🎓</div>
                    )}
                    {/* Type badge */}
                    {cls.format && cls.format !== 'recorded' && (
                      <div className="absolute top-2 left-2">
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {cls.format === 'live' ? 'Live' : 'Live + Recorded'}
                        </span>
                      </div>
                    )}
                    {/* Price badge */}
                    <div className="absolute top-2 right-2">
                      {cls.pricing_model === 'free' ? (
                        <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">FREE</span>
                      ) : (
                        <span className="bg-black/80 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          ${cls.price_usd?.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {/* Level badge */}
                    {cls.level && (
                      <div className="absolute bottom-2 left-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${LEVEL_COLORS[cls.level] ?? ''}`}>
                          {cls.level}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="p-4">
                    <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                      {cls.title}
                    </h3>
                    {creator && (
                      <p className="text-muted-foreground text-xs mb-2">
                        {creator.display_name ?? creator.username}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {cls.lesson_count} lessons
                      </span>
                      {cls.total_duration_seconds > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(cls.total_duration_seconds)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {cls.enrollment_count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-24">
            <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No classes found</h3>
            <p className="text-muted-foreground">
              {type || category || level
                ? 'Try adjusting your filters to find more classes.'
                : 'Check back soon — new classes are being added all the time.'}
            </p>
          </div>
        )}
      </main>
    </AppShell>
  )
}
