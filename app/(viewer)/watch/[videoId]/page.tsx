import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import VideoPlayerClient from '@/components/video/VideoPlayerClient'
import LikeButton from '@/components/video/LikeButton'
import TriedThisButton from '@/components/video/TriedThisButton'
import CommentsSection from '@/components/video/CommentsSection'
import ChannelSubscribeButton from '@/components/video/ChannelSubscribeButton'
import ShareButton from '@/components/video/ShareButton'
import VideoCard from '@/components/video/VideoCard'
import ReportButton from '@/components/video/ReportButton'
import RecipeCard from '@/components/recipe/RecipeCard'
import VerifiedChefBadge from '@/components/badges/VerifiedChefBadge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatViews } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { Eye, Calendar } from 'lucide-react'
import type { Video, Comment } from '@/types'
import { SAMPLE_VIDEOS } from '@/lib/sample-data'
import dynamic from 'next/dynamic'

const MuxPlayer = dynamic(() => import('@mux/mux-player-react'), { ssr: false })

interface PageProps {
  params: { videoId: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const BASE = 'https://hapieatstv.com'

  if (params.videoId.startsWith('sample-')) {
    const sample = SAMPLE_VIDEOS.find(v => v.id === params.videoId)
    return {
      title: sample?.title ?? 'Watch',
      description: `Watch ${sample?.title ?? 'food videos'} on HapiEats TV.`,
    }
  }

  const supabase = createServiceClient()
  const { data: video } = await supabase
    .from('videos')
    .select('title, description, mux_playback_id, creator:profiles(username, display_name)')
    .eq('id', params.videoId)
    .single()

  if (!video) return { title: 'Watch', description: 'Watch food videos on HapiEats TV.' }

  const vid = video as any
  const title = vid.title as string
  const description = (vid.description as string | null)?.slice(0, 160) ?? `Watch ${title} on HapiEats TV.`
  const creatorName = vid.creator?.display_name ?? vid.creator?.username ?? 'a creator'
  const pageUrl = `${BASE}/watch/${params.videoId}`

  // Mux generates thumbnails automatically at this URL
  const ogImage = vid.mux_playback_id
    ? `https://image.mux.com/${vid.mux_playback_id}/thumbnail.jpg?width=1200&height=630&fit_mode=smartcrop&time=0`
    : undefined

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: `${title} | HapiEats TV`,
      description,
      type: 'video.other',
      url: pageUrl,
      siteName: 'HapiEats TV',
      locale: 'en_US',
      ...(ogImage && {
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
        videos: [{
          url: `${BASE}/watch/${params.videoId}`,
          type: 'text/html',
          width: 1280,
          height: 720,
        }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      site: '@hapieatstv',
      title: `${title} | HapiEats TV`,
      description: `by ${creatorName} — ${description}`,
      ...(ogImage && { images: [ogImage] }),
    },
  }
}

export default async function WatchPage({ params }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Handle sample video IDs ─────────────────────────────────────
  if (params.videoId.startsWith('sample-')) {
    const sample = SAMPLE_VIDEOS.find(v => v.id === params.videoId)
    if (!sample) notFound()

    return (
      <AppShell>
        <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
              <MuxPlayer
                playbackId={sample.muxPlaybackId}
                streamType="on-demand"
                style={{ width: '100%', height: '100%' } as React.CSSProperties}
              />
            </div>
            <div className="mt-4">
              <h1 className="text-xl font-bold">{sample.title}</h1>
              <p className="text-muted-foreground text-sm mt-2 flex items-center gap-3">
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{formatViews(sample.viewCount)} views</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDistanceToNow(new Date(sample.publishedAt), { addSuffix: true })}</span>
              </p>
            </div>
            <div className="mt-4 p-4 rounded-xl border bg-card flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={sample.channelAvatar} />
                <AvatarFallback className="bg-primary text-white">{sample.channelName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{sample.channelName}</p>
                <p className="text-sm text-muted-foreground">Sample creator</p>
              </div>
            </div>
            <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary/90">
              🎬 <strong>Sample video</strong> — this is demo content.{' '}
              <Link href="/studio/upload" className="underline font-medium">Upload your own video →</Link>
            </div>
          </div>
          <aside>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">More Sample Videos</p>
            <div className="flex flex-col gap-3">
              {SAMPLE_VIDEOS.filter(v => v.id !== params.videoId).slice(0, 6).map(v => (
                <Link key={v.id} href={`/watch/${v.id}`} className="flex gap-3 group">
                  <div className="relative w-32 aspect-video rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.thumbnailUrl} alt={v.title} className="object-cover w-full h-full" />
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-mono">{v.duration}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold line-clamp-2 group-hover:text-primary transition-colors">{v.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{v.channelName}</p>
                    <p className="text-[11px] text-muted-foreground">{formatViews(v.viewCount)} views</p>
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        </main>
      </AppShell>
    )
  }

  // ── Handle real DB videos ────────────────────────────────────────
  // Use service client to bypass RLS — access control is enforced below
  const serviceSupabase = createServiceClient()
  const { data: video } = await serviceSupabase
    .from('videos')
    .select(`
      *,
      channel:channels(id, name, slug, thumbnail_url, subscription_price, stripe_price_id),
      creator:profiles(id, username, display_name, avatar_url, bio, is_verified_chef)
    `)
    .eq('id', params.videoId)
    .eq('status', 'ready')
    .single()

  if (!video) notFound()

  // Check access
  let hasAccess = video.pricing_model === 'free'

  if (!hasAccess && user) {
    if (video.pricing_model === 'pay_per_view') {
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('video_id', video.id)
        .single()
      hasAccess = !!purchase
    }
    if (video.pricing_model === 'subscription') {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('subscriber_id', user.id)
        .eq('channel_id', video.channel_id)
        .eq('status', 'active')
        .single()
      hasAccess = !!sub
    }
  }

  // Track view (fire-and-forget)
  if (hasAccess) {
    supabase.from('video_views').insert({ video_id: video.id, viewer_id: user?.id ?? null })
  }

  // Fetch comments
  const { data: commentsData } = await supabase
    .from('comments')
    .select('*, author:profiles(id, username, display_name, avatar_url)')
    .eq('video_id', video.id)
    .order('created_at', { ascending: true })

  const comments: Comment[] = (commentsData as Comment[]) ?? []

  // Check like status
  let userLiked = false
  if (user) {
    const { data: likeRow } = await supabase
      .from('video_likes')
      .select('id')
      .eq('video_id', video.id)
      .eq('user_id', user.id)
      .single()
    userLiked = !!likeRow
  }

  // Check channel subscription status
  let isSubscribed = false
  if (user && video.channel_id) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', user.id)
      .eq('channel_id', video.channel_id)
      .eq('status', 'active')
      .single()
    isSubscribed = !!sub
  }

  // Fetch recipe card for this video (if any)
  const { data: recipe } = await serviceSupabase
    .from('recipe_cards')
    .select('*')
    .eq('video_id', video.id)
    .maybeSingle()

  // Fetch "tried this" status + count
  let userTried = false
  const { count: triedCount } = await serviceSupabase
    .from('tried_this')
    .select('id', { count: 'exact', head: true })
    .eq('video_id', video.id)
  if (user) {
    const { data: triedRow } = await supabase
      .from('tried_this')
      .select('id')
      .eq('video_id', video.id)
      .eq('user_id', user.id)
      .maybeSingle()
    userTried = !!triedRow
  }

  // Check if creator is a verified chef
  const isVerifiedChef = !!(video.creator as (typeof video.creator & { is_verified_chef?: boolean }) | undefined)?.is_verified_chef

  // Fetch related videos — from same channel if there is one, else from same creator
  const relatedQuery = supabase
    .from('videos')
    .select(`
      *,
      channel:channels(id, name, slug, thumbnail_url),
      creator:profiles(id, username, display_name, avatar_url)
    `)
    .eq('status', 'ready')
    .eq('visibility', 'public')
    .neq('id', video.id)
    .neq('is_clip', true)
    .order('published_at', { ascending: false })
    .limit(8)

  const { data: relatedVideos } = video.channel_id
    ? await relatedQuery.eq('channel_id', video.channel_id)
    : await relatedQuery.eq('creator_id', video.creator_id)

  // Fetch more videos from site if not enough related
  const { data: moreVideos } = (relatedVideos?.length ?? 0) < 4
    ? await supabase
        .from('videos')
        .select(`
          *,
          channel:channels(id, name, slug, thumbnail_url),
          creator:profiles(id, username, display_name, avatar_url)
        `)
        .eq('status', 'ready')
        .eq('visibility', 'public')
        .neq('id', video.id)
        .neq('creator_id', video.creator_id)
        .neq('is_clip', true)
        .order('view_count', { ascending: false })
        .limit(8)
    : { data: [] }

  const sidebarVideos = [...(relatedVideos ?? []), ...(moreVideos ?? [])].slice(0, 8) as Video[]

  const channelSlug = video.channel?.slug ?? video.creator?.username
  const pricingLabel =
    video.pricing_model === 'pay_per_view' ? `$${video.price} PPV`
    : video.pricing_model === 'subscription' ? 'Subscribers Only'
    : null

  const vid = video as any
  const videoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: (video.description as string | null) ?? `Watch ${video.title} on HapiEats TV.`,
    thumbnailUrl: vid.mux_playback_id
      ? `https://image.mux.com/${vid.mux_playback_id}/thumbnail.jpg?width=1280&height=720&fit_mode=preserve&time=0`
      : 'https://hapieatstv.com/icon',
    uploadDate: video.created_at ?? new Date().toISOString(),
    contentUrl: `https://hapieatstv.com/watch/${video.id}`,
    embedUrl: `https://hapieatstv.com/watch/${video.id}`,
    author: {
      '@type': 'Person',
      name: vid.creator?.display_name ?? vid.creator?.username ?? 'HapiEats Creator',
      url: vid.creator?.username ? `https://hapieatstv.com/profile/${vid.creator.username}` : 'https://hapieatstv.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'HapiEats TV',
      url: 'https://hapieatstv.com',
      logo: { '@type': 'ImageObject', url: 'https://hapieatstv.com/icon', width: 32, height: 32 },
    },
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'WatchAction' },
      userInteractionCount: video.view_count ?? 0,
    },
  }

  return (
    <AppShell>
      <Script
        id="video-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd).replace(/</g, '\\u003c') }}
      />
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Player column ── */}
        <div className="lg:col-span-2">
          <VideoPlayerClient
            video={video as Video}
            hasAccess={hasAccess}
            userId={user?.id ?? null}
          />

          {/* Title + actions row */}
          <div className="mt-4">
            <div className="flex items-start gap-2 flex-wrap">
              <h1 className="text-xl font-bold flex-1">{video.title}</h1>
              {pricingLabel && (
                <Badge variant="outline" className="text-primary border-primary/40 shrink-0">
                  {pricingLabel}
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {formatViews(video.view_count ?? 0)} views
                </span>
                {video.published_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDistanceToNow(new Date(video.published_at), { addSuffix: true })}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <LikeButton
                  videoId={video.id}
                  initialLiked={userLiked}
                  initialCount={video.like_count ?? 0}
                />
                {recipe && (
                  <TriedThisButton
                    videoId={video.id}
                    initialTried={userTried}
                    initialCount={triedCount ?? 0}
                  />
                )}
                <ShareButton videoId={video.id} title={video.title} />
                <ReportButton targetId={video.id} type={video.post_type === 'post' ? 'post' : 'video'} userId={user?.id ?? null} />
              </div>
            </div>
          </div>

          {/* Creator / channel info card */}
          <div className="mt-6 p-4 rounded-xl border bg-card">
            <div className="flex items-start gap-4">
              <Link href={channelSlug ? `/channel/${channelSlug}` : '#'}>
                <Avatar className="h-12 w-12 hover:ring-2 ring-primary/40 transition">
                  <AvatarImage src={video.creator?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-white">
                    {video.creator?.display_name?.charAt(0) ?? 'C'}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={channelSlug ? `/channel/${channelSlug}` : '#'} className="hover:text-primary transition">
                  <p className="font-semibold truncate flex items-center gap-1.5">
                    {video.creator?.display_name ?? video.creator?.username}
                    {isVerifiedChef && <VerifiedChefBadge />}
                  </p>
                </Link>
                {video.channel?.name && (
                  <p className="text-sm text-muted-foreground">{video.channel.name}</p>
                )}
                {video.creator?.bio && (
                  <p className="text-sm mt-1 text-muted-foreground line-clamp-2">{video.creator.bio}</p>
                )}
              </div>
              {video.channel && (
                <div className="shrink-0">
                  <ChannelSubscribeButton
                    channel={video.channel}
                    userId={user?.id ?? null}
                    isSubscribed={isSubscribed}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {video.description && (
            <div className="mt-4 p-4 rounded-xl bg-muted/60 text-sm whitespace-pre-wrap leading-relaxed">
              {video.description}
            </div>
          )}

          {/* Recipe Card */}
          {recipe && <RecipeCard recipe={recipe} />}

          <hr className="mt-6 border-border" />

          {/* Comments */}
          <CommentsSection
            videoId={video.id}
            initialComments={comments}
            currentUserId={user?.id ?? null}
          />
        </div>

        {/* ── Sidebar — related videos ── */}
        <aside className="space-y-3">
          {(relatedVideos?.length ?? 0) > 0 && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              More from {video.channel?.name ?? 'this creator'}
            </p>
          )}
          {sidebarVideos.length > 0 ? (
            <div className="flex flex-col gap-3">
              {sidebarVideos.map((v) => (
                <VideoCard key={v.id} video={v} compact />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No related videos yet.</p>
          )}
        </aside>
      </main>
    </AppShell>
  )
}
