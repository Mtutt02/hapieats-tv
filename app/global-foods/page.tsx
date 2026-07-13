import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Users, Video, Globe, UploadCloud, Tv } from 'lucide-react'
import { formatViews } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Global Foods',
  description:
    'A world tour on your plate — explore authentic recipes and street food from every region, from East Asia to Latin America.',
}

export const dynamic = 'force-dynamic'

// ── Regions ───────────────────────────────────────────────────────────────────
// Each region has keywords used to bucket station videos by title match.
interface Region {
  key: string
  name: string
  emoji: string
  blurb: string
  keywords: string[]
}

const REGIONS: Region[] = [
  { key: 'east-asia',     name: 'East Asia',      emoji: '🥢', blurb: 'China · Japan · Korea',
    keywords: ['china', 'chinese', 'sichuan', 'szechuan', 'cantonese', 'dim sum', 'japan', 'japanese', 'sushi', 'ramen', 'udon', 'korea', 'korean', 'kimchi', 'bibimbap', 'bao', 'wok', 'dumpling'] },
  { key: 'southeast-asia', name: 'Southeast Asia', emoji: '🍜', blurb: 'Thai · Viet · Filipino',
    keywords: ['thai', 'thailand', 'pad', 'pho', 'vietnam', 'vietnamese', 'banh', 'filipino', 'adobo', 'indonesia', 'malaysia', 'satay', 'laksa', 'nasi'] },
  { key: 'south-asia',    name: 'South Asia',     emoji: '🍛', blurb: 'India · Pakistan · Sri Lanka',
    keywords: ['india', 'indian', 'masala', 'tikka', 'biryani', 'dosa', 'paneer', 'tandoori', 'naan', 'curry', 'pakistani', 'dal', 'samosa'] },
  { key: 'middle-east',   name: 'Middle East',    emoji: '🧆', blurb: 'Levant · Persian · Turkish',
    keywords: ['lebanese', 'hummus', 'falafel', 'shawarma', 'kebab', 'persian', 'iran', 'turkish', 'turkey', 'mezze', 'tahini', 'zaatar', 'baklava', 'pita'] },
  { key: 'africa',        name: 'Africa',         emoji: '🍲', blurb: 'West · East · North African',
    keywords: ['african', 'africa', 'nigerian', 'jollof', 'ethiopian', 'injera', 'moroccan', 'tagine', 'egyptian', 'suya', 'ghana', 'kenyan'] },
  { key: 'latin-america', name: 'Latin America',  emoji: '🌮', blurb: 'Mexico · Peru · Brazil',
    keywords: ['mexic', 'taco', 'peru', 'peruvian', 'ceviche', 'brazil', 'brazilian', 'argentin', 'empanada', 'arepa', 'latin', 'colombia', 'birria', 'mole'] },
  { key: 'caribbean',     name: 'Caribbean',      emoji: '🏝️', blurb: 'Jamaica · Cuba · Trinidad',
    keywords: ['caribbean', 'jamaican', 'jerk', 'cuban', 'trinidad', 'haitian', 'plantain', 'roti', 'callaloo'] },
  { key: 'europe',        name: 'Europe',         emoji: '🥖', blurb: 'France · Spain · Greece',
    keywords: ['french', 'france', 'spanish', 'spain', 'paella', 'greek', 'greece', 'german', 'british', 'mediterranean', 'portuguese', 'polish'] },
]

interface StationRow {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  cover_url: string | null
  follower_count: number
  video_count: number
}

interface VideoRow {
  id: string
  title: string
  thumbnail_url: string | null
  view_count: number | null
  duration: string | null
  created_at: string
  channel: { name: string | null; thumbnail_url: string | null } | null
}

async function getStation(): Promise<StationRow | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('stations')
    .select('id, slug, name, description, icon, cover_url, follower_count, video_count')
    .eq('slug', 'global-foods')
    .single()
  return (data as StationRow) ?? null
}

async function getVideos(stationId: string): Promise<VideoRow[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, view_count, duration, created_at, channel:channels(name, thumbnail_url)')
    .eq('station_id', stationId)
    .eq('status', 'ready')
    .neq('is_clip', true)
    .order('created_at', { ascending: false })
    .limit(60)
  return (data as unknown as VideoRow[]) ?? []
}

function matchesRegion(title: string, region: Region): boolean {
  const t = title.toLowerCase()
  return region.keywords.some(k => t.includes(k))
}

interface PageProps {
  searchParams: { region?: string }
}

export default async function GlobalFoodsPage({ searchParams }: PageProps) {
  const station = await getStation()
  const allVideos = station ? await getVideos(station.id) : []

  const activeRegion = REGIONS.find(r => r.key === searchParams.region) ?? null
  const videos = activeRegion
    ? allVideos.filter(v => matchesRegion(v.title, activeRegion))
    : allVideos

  const cover = station?.cover_url ?? 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=1200&q=80'
  const uploadHref = station ? `/studio/upload?stationId=${station.id}` : '/studio/upload'

  return (
    <AppShell>
      <div className="pb-24 md:pb-8">
      {/* Hero */}
      <div className="relative w-full h-52 md:h-64">
        <Image src={cover} alt="Global Foods" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-0 flex items-end">
          <div className="px-4 md:px-6 pb-6 max-w-3xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-2">
              <Globe className="h-3.5 w-3.5" /> Designated Section
            </span>
            <h1 className="text-3xl md:text-4xl font-black leading-tight flex items-center gap-3">
              <span>🌍</span> Global Foods
            </h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-xl">
              {station?.description ??
                'A world tour on your plate — authentic recipes and street eats from every continent.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Link href={uploadHref}>
                <Button size="sm" className="gap-1.5">
                  <UploadCloud className="h-4 w-4" /> Post to Global Foods
                </Button>
              </Link>
              <Link href="/tv">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Tv className="h-4 w-4" /> Watch on Ch. 13
                </Button>
              </Link>
              {station && (
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{formatViews(station.follower_count)}</span>
                  <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" />{allVideos.length || station.video_count} videos</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Explore by region */}
      <div className="px-4 md:px-6 mt-6">
        <h2 className="text-base font-bold mb-3">Explore by region</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/global-foods"
            className={[
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              !activeRegion ? 'border-primary bg-primary/12 text-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
            ].join(' ')}
          >
            🌍 All regions
          </Link>
          {REGIONS.map(r => {
            const active = activeRegion?.key === r.key
            return (
              <Link
                key={r.key}
                href={`/global-foods?region=${r.key}`}
                className={[
                  'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  active ? 'border-primary bg-primary/12 text-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                ].join(' ')}
                title={r.blurb}
              >
                {r.emoji} {r.name}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Videos */}
      <div className="px-4 md:px-6 mt-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-base font-bold">
            {activeRegion ? `${activeRegion.emoji} ${activeRegion.name}` : 'Latest from around the world'}
          </h2>
          {activeRegion && (
            <Link href="/global-foods" className="text-xs text-primary hover:underline">Clear filter</Link>
          )}
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
            <span className="text-5xl block mb-4">{activeRegion?.emoji ?? '🌍'}</span>
            <p className="font-medium mb-1">
              {activeRegion ? `No ${activeRegion.name} dishes here yet` : 'No videos in Global Foods yet'}
            </p>
            <p className="text-sm mb-4">Be the first to share a recipe from this part of the world.</p>
            <Link href={uploadHref}>
              <Button size="sm">Post the first video</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {videos.map(video => (
              <Link key={video.id} href={`/watch/${video.id}`} className="group block">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted mb-3">
                  {video.thumbnail_url ? (
                    <Image
                      src={video.thumbnail_url}
                      alt={video.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-3xl">🎬</div>
                  )}
                  {video.duration && (
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                      {video.duration}
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                    <AvatarImage src={video.channel?.thumbnail_url ?? ''} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {video.channel?.name?.charAt(0) ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {video.title}
                    </h3>
                    <p className="text-muted-foreground text-xs mt-1">{video.channel?.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatViews(video.view_count ?? 0)} views · {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      </div>
    </AppShell>
  )
}
