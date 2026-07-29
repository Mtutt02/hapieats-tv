import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import ProfileHero, { type ProfileData } from '@/components/profile/ProfileHero'
import ProfileStats from '@/components/profile/ProfileStats'
import ProfileTabs from '@/components/profile/ProfileTabs'
import { type ProfileClip } from '@/components/profile/ClipsGrid'
import type { Video } from '@/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('display_name, bio, avatar_url')
    .eq('username', username)
    .single()

  const name = profile?.display_name ?? `@${username}`
  const description = profile?.bio?.slice(0, 160) ?? `Watch food videos from @${username} on HapiEats TV.`
  const pageUrl = `https://hapieatstv.com/u/${username}`

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
  }
}

export default async function ProfileV3Page({ params }: Props) {
  const { username } = await params
  const supabase = createClient()
  const svc = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Profile (service client — bypass RLS for logged-out visitors) ─
  const { data: profile } = await svc
    .from('profiles')
    .select(`
      id, username, display_name, avatar_url, cover_url, bio,
      is_creator, is_verified_chef, role, created_at,
      follower_count, location, website, flavor_profile,
      video_count, clip_count, streak_count
    `)
    .eq('username', username)
    .single()

  if (!profile) notFound()

  const isOwnProfile = user?.id === profile.id
  const isSignedIn = !!user

  // ── Videos (service client — public content visible to all) ──────
  const { data: videos } = await svc
    .from('videos')
    .select(`*, channel:channels(id, name, slug, thumbnail_url), creator:profiles(id, username, display_name, avatar_url)`)
    .eq('creator_id', profile.id)
    .eq('status', 'ready')
    .eq('visibility', 'public')
    .order('published_at', { ascending: false })
    .limit(100)

  const allVideos = (videos ?? []) as (Video & { is_clip?: boolean })[]
  const longFormVideos = allVideos.filter(v => !v.is_clip)

  // ── Clips ────────────────────────────────────────────────────────
  let clips: ProfileClip[] = []
  try {
    const { data, error } = await svc
      .from('videos')
      .select('id, title, mux_playback_id, view_count')
      .eq('creator_id', profile.id)
      .eq('is_clip', true)
      .eq('status', 'ready')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(24)
    if (!error && data) clips = data as ProfileClip[]
  } catch { /* is_clip column may not exist */ }

  // ── Channels + Station ───────────────────────────────────────────
  const { data: channels } = await svc
    .from('channels')
    .select('id, name, slug, thumbnail_url, subscriber_count, description, station_id')
    .eq('creator_id', profile.id)
    .limit(6)

  const { data: stationData } = channels?.[0]?.station_id
    ? await svc.from('stations').select('id, name').eq('id', (channels[0] as any).station_id).single()
    : { data: null }

  // ── Follow state (user-scoped client — respects auth) ────────────
  let initialFollowing = false
  if (user && !isOwnProfile) {
    try {
      const { data } = await supabase
        .from('creator_follows')
        .select('creator_id')
        .eq('follower_id', user.id)
        .eq('creator_id', profile.id)
        .maybeSingle()
      initialFollowing = !!data
    } catch { /* table may not exist */ }
  }

  // ── Goals ────────────────────────────────────────────────────────
  let goals: any[] = []
  try {
    const { data: goalData } = await svc
      .from('creator_goals')
      .select('*')
      .eq('creator_id', profile.id)
      .order('created_at', { ascending: false })
    if (goalData) goals = goalData
  } catch { /* table may not exist */ }

  // ── Live check ───────────────────────────────────────────────────
  let isLive = false
  try {
    const { data: live } = await svc
      .from('live_streams')
      .select('id')
      .eq('creator_id', profile.id)
      .eq('status', 'active')
      .limit(1)
    isLive = !!live?.length
  } catch { /* table may not exist */ }

  // ── Compute stats ────────────────────────────────────────────────
  const totalDuration = allVideos.reduce((sum, v) => sum + (v.duration ?? 0), 0)
  const totalViews = allVideos.reduce((sum, v) => sum + (v.view_count ?? 0), 0)

  const profileData: ProfileData = {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name ?? null,
    avatarUrl: profile.avatar_url ?? null,
    coverUrl: profile.cover_url ?? null,
    bio: profile.bio ?? null,
    isCreator: profile.is_creator ?? false,
    isVerifiedChef: profile.is_verified_chef ?? false,
    role: profile.role ?? null,
    createdAt: profile.created_at,
    followerCount: profile.follower_count ?? null,
    cuisineTags: [],
    location: profile.location ?? null,
    website: profile.website ?? null,
    totalViews,
    totalDuration,
    videoCount: longFormVideos.length,
    clipCount: clips.length,
    channelCount: (channels ?? []).length,
    flavorProfile: profile.flavor_profile ?? null,
    streakCount: profile.streak_count ?? 0,
    isLive,
  }

  const channelSlug = (channels?.[0] as any)?.slug ?? undefined

  return (
    <AppShell fullWidth>
      <main className="max-w-6xl mx-auto">
        <ProfileHero
          profile={profileData}
          isOwnProfile={isOwnProfile}
          isSignedIn={isSignedIn}
          initialFollowing={initialFollowing}
          channelSlug={channelSlug}
          stationName={(stationData as any)?.name ?? undefined}
        />
        <ProfileStats
          followerCount={profileData.followerCount}
          videoCount={profileData.videoCount}
          clipCount={profileData.clipCount}
          channelCount={profileData.channelCount}
          totalDuration={profileData.totalDuration}
          totalViews={profileData.totalViews}
        />
        <ProfileTabs
          profile={profileData}
          videos={longFormVideos}
          clips={clips}
          channels={(channels ?? []) as any[]}
          goals={goals}
        />
      </main>
    </AppShell>
  )
}
