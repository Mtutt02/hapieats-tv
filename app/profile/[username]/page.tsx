import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import VideoCard from '@/components/video/VideoCard'
import VerifiedChefBadge from '@/components/badges/VerifiedChefBadge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Settings,
  Tv,
  Users,
  Film,
  CalendarDays,
  Play,
  ExternalLink,
  ChefHat,
  Flame,
  Clapperboard,
  Sparkles,
  Star,
} from 'lucide-react'
import type { Video } from '@/types'

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, bio, avatar_url')
    .eq('username', params.username)
    .single()

  const name = profile?.display_name ?? `@${params.username}`
  const description =
    profile?.bio?.slice(0, 160) ?? `Watch food videos from @${params.username} on HapiEats TV.`
  const pageUrl = `https://hapieatstv.com/profile/${params.username}`

  return {
    title: name,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: `${name} | HapiEats TV`,
      description,
      type: 'profile',
      url: pageUrl,
      siteName: 'HapiEats TV',
      ...(profile?.avatar_url && {
        images: [{ url: profile.avatar_url, width: 400, height: 400, alt: name }],
      }),
    },
    twitter: {
      card: profile?.avatar_url ? 'summary' : 'summary',
      title: `${name} on HapiEats TV`,
      description,
      ...(profile?.avatar_url && { images: [profile.avatar_url] }),
    },
  }
}

/** Formats seconds → "0:30" for clip duration badges */
function formatClipDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0:30'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Formats count like numbers on restaurant menus (K instead of stale K) */
function menuFormat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

// ─── TV-styled section header ───────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  label,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  badge?: string
}) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h2 className="text-lg font-bold tracking-tight">{label}</h2>
      {badge && (
        <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary/70 border border-primary/20">
          {badge}
        </span>
      )}
    </div>
  )
}

// ─── Profile stat pill ──────────────────────────────────────────────────────
function StatPill({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
      <Icon className={`h-3.5 w-3.5 ${highlight ? 'text-primary' : 'text-muted-foreground/60'}`} />
      <span className="text-sm">
        <strong className={`${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</strong>
        <span className="text-muted-foreground ml-1">{label}</span>
      </span>
    </div>
  )
}

// ─── Clip card for the horizontal scroll ────────────────────────────────────
function ClipThumbCard({
  clip,
}: {
  clip: Video
}) {
  const thumbnail = clip.mux_playback_id
    ? `https://image.mux.com/${clip.mux_playback_id}/thumbnail.jpg?width=360&fit_mode=preserve&time=1`
    : clip.thumbnail_url ?? ''

  return (
    <Link
      href={`/watch/${clip.id}`}
      className="group block w-40 sm:w-44 flex-shrink-0 snap-start"
    >
      <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-muted border border-border/40 group-hover:border-primary/40 transition-all duration-200">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={clip.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-primary/10 to-orange-500/10">
            <Clapperboard className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Hover play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="h-10 w-10 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center border border-white/40 shadow-lg">
            <Play className="h-5 w-5 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Duration badge */}
        {clip.duration && (
          <span className="absolute bottom-2 left-2 z-10 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            {formatClipDuration(clip.duration)}
          </span>
        )}

        {/* View count */}
        <span className="absolute bottom-2 right-2 z-10 text-white/80 text-[10px] font-medium flex items-center gap-1 drop-shadow">
          <Play className="h-3 w-3" />
          {menuFormat(clip.view_count ?? 0)}
        </span>
      </div>
      <h3 className="text-xs font-medium mt-1.5 line-clamp-2 leading-snug text-foreground/90 group-hover:text-primary transition-colors">
        {clip.title}
      </h3>
    </Link>
  )
}

// ─── Main profile page ──────────────────────────────────────────────────────
export default async function ProfilePage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, banner_url, bio, is_creator, is_verified_chef, role, created_at'
    )
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  const isOwnProfile = user?.id === profile.id

  // ── Fetch public videos ──────────────────────────────────────────────────
  const { data: videos } = await supabase
    .from('videos')
    .select(
      `
      *,
      channel:channels(id, name, slug, thumbnail_url),
      creator:profiles(id, username, display_name, avatar_url)
    `
    )
    .eq('creator_id', profile.id)
    .eq('status', 'ready')
    .eq('visibility', 'public')
    .order('published_at', { ascending: false })
    .limit(24)

  // ── Fetch this user's clips separately ───────────────────────────────────
  const { data: clips } = await supabase
    .from('videos')
    .select(
      `
      *,
      creator:profiles(id, username, display_name, avatar_url)
    `
    )
    .eq('creator_id', profile.id)
    .eq('is_clip', true)
    .eq('status', 'ready')
    .eq('visibility', 'public')
    .not('mux_playback_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  // ── Fetch their channels ─────────────────────────────────────────────────
  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, slug, thumbnail_url, subscriber_count, video_count, description')
    .eq('creator_id', profile.id)
    .limit(6)

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const totalViews = (videos ?? []).reduce((sum, v) => sum + (v.view_count ?? 0), 0)
  const totalLikes = (videos ?? []).reduce((sum, v) => sum + ((v as any).like_count ?? 0), 0)
  const totalClips = clips?.length ?? 0
  const totalVideos = (videos ?? []).filter(v => !v.is_clip).length

  const joinedYear = new Date(profile.created_at).getFullYear()
  const initials = profile.display_name?.charAt(0) ?? profile.username?.charAt(0) ?? 'U'

  // Chef heat level (flame emoji, based on tenure)
  const chefYears = profile.is_verified_chef
    ? Math.max(1, new Date().getFullYear() - joinedYear)
    : 0
  const heatLevel = Math.min(chefYears, 5) + (totalVideos > 10 ? 1 : 0) + (totalClips > 5 ? 1 : 0)
  const maxHeat = 5

  return (
    <AppShell>
      {/* ════════════════════════════════════════════════════════════
          HERO BANNER — TV Static Gradient / Cover Image
          ════════════════════════════════════════════════════════════ */}
      <div className="relative w-full h-44 sm:h-52 md:h-60 lg:h-64 bg-muted overflow-hidden">
        {profile.banner_url ? (
          <img
            src={profile.banner_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          /* Food-TV gradient: warm amber → deep orange → muted eggplant */
          <div className="w-full h-full bg-gradient-to-br from-amber-700/40 via-orange-600/20 to-zinc-900/50" />
        )}
        {/* Scanline overlay (subtle) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)',
          }}
        />
        {/* Bottom fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-transparent" />
      </div>

      {/* ════════════════════════════════════════════════════════════
          PROFILE — Avatar floating over banner
          ════════════════════════════════════════════════════════════ */}
      <main className="max-w-6xl mx-auto px-4 pb-14">
        <div className="relative -mt-16 sm:-mt-20 md:-mt-24 mb-5 flex items-end gap-4 flex-wrap">
          {/* Avatar */}
          <Avatar className="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 shrink-0 ring-4 ring-background rounded-full shadow-xl">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-orange-500 text-white text-3xl sm:text-4xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Name + badges */}
          <div className="flex-1 min-w-0 pt-2 sm:pt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {profile.display_name ?? profile.username}
              </h1>
              {profile.is_verified_chef && (
                <span className="flex items-center gap-1 text-amber-500 text-sm font-semibold">
                  <VerifiedChefBadge showLabel />
                  <span className="hidden sm:inline text-muted-foreground text-xs font-normal">
                    · {heatLevel}/{maxHeat} <Flame className="h-3 w-3 inline text-orange-400" />
                  </span>
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">@{profile.username}</p>

            {/* Badge row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {profile.is_creator && (
                <Badge
                  variant="outline"
                  className="text-primary border-primary/40 text-[10px] font-semibold uppercase tracking-wider h-5"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Creator
                </Badge>
              )}
              {profile.role === 'admin' && (
                <Badge
                  variant="outline"
                  className="text-yellow-500 border-yellow-500/40 text-[10px] font-semibold uppercase tracking-wider h-5"
                >
                  <Star className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
              )}
              {totalVideos > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-semibold uppercase tracking-wider h-5 bg-orange-500/10 text-orange-600 border-orange-200 dark:text-orange-400 dark:border-orange-800"
                >
                  <ChefHat className="h-3 w-3 mr-1" />
                  {totalVideos} recipe{totalVideos !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 w-full sm:w-auto">
            {isOwnProfile ? (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  Edit Profile
                </Link>
              </Button>
            ) : null}
            {profile.is_creator && channels && channels.length > 0 && (
              <Button asChild size="sm" className="gap-2 shadow-md">
                <Link href={`/channel/${channels[0].slug}`}>
                  <Tv className="h-4 w-4" />
                  View Channel
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            BIO — AKA "The Tasting Notes"
            ════════════════════════════════════════════════════════ */}
        {profile.bio && (
          <div className="relative mb-6">
            <div className="absolute -left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 to-orange-500/30 rounded-full" />
            <p className="text-sm sm:text-base leading-relaxed text-foreground/80 max-w-3xl pl-3 italic">
              &ldquo;{profile.bio}&rdquo;
            </p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            STAT PILLS
            ════════════════════════════════════════════════════════ */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {totalVideos > 0 && (
            <StatPill icon={Film} label="videos" value={totalVideos} />
          )}
          {totalClips > 0 && (
            <StatPill
              icon={Clapperboard}
              label="quick bites"
              value={totalClips}
              highlight
            />
          )}
          {totalViews > 0 && (
            <StatPill icon={Play} label="served" value={menuFormat(totalViews)} />
          )}
          {totalLikes > 0 && (
            <StatPill icon={ChefHat} label="likes" value={menuFormat(totalLikes)} />
          )}
          {channels && channels.length > 0 && (
            <StatPill icon={Tv} label="channels" value={channels.length} />
          )}
          {profile.is_verified_chef && (
            <StatPill icon={ChefHat} label="verified chef" value="✓" highlight />
          )}
          <StatPill
            icon={CalendarDays}
            label={`joined ${joinedYear}`}
            value=""
          />
        </div>

        {/* ════════════════════════════════════════════════════════
            QUICK BITES — Clips scroll
            ════════════════════════════════════════════════════════ */}
        {clips && clips.length > 0 && (
          <section className="mb-10">
            <SectionHeader
              icon={Clapperboard}
              label="Quick Bites"
              badge={`${totalClips} clips`}
            />
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(clips as Video[]).map(clip => (
                <ClipThumbCard key={clip.id} clip={clip} />
              ))}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════
            CHANNELS
            ════════════════════════════════════════════════════════ */}
        {channels && channels.length > 0 && (
          <section className="mb-10">
            <SectionHeader
              icon={Tv}
              label="Channels"
              badge={`${channels.length} total`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {channels.map(ch => (
                <Link
                  key={ch.id}
                  href={`/channel/${ch.slug}`}
                  className="group relative overflow-hidden rounded-xl border bg-card hover:bg-muted/40 transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
                >
                  {/* Channel thumbnail */}
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {ch.thumbnail_url ? (
                      <img
                        src={ch.thumbnail_url}
                        alt={ch.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-orange-500/10">
                        <Tv className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                    )}
                    {/* Hover dark overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>

                  <div className="p-3">
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                      {ch.name}
                    </p>
                    {ch.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {ch.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {ch.subscriber_count.toLocaleString()} subscribers
                      </span>
                      {ch.video_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Film className="h-3 w-3" />
                          {ch.video_count} videos
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════
            VIDEOS — Full recipe videos
            ════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            icon={Film}
            label="Full Recipes"
            badge={totalVideos > 0 ? `${totalVideos} videos` : undefined}
          />
          {(videos?.length ?? 0) === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Film className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No public videos yet.</p>
              {isOwnProfile && (
                <Button asChild variant="outline" size="sm" className="mt-4 gap-2">
                  <Link href="/studio/upload">
                    <ExternalLink className="h-4 w-4" />
                    Upload your first recipe
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {(videos as Video[]).map(v => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  )
}
