import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import VideoCard from '@/components/video/VideoCard'
import VerifiedChefBadge from '@/components/badges/VerifiedChefBadge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Settings, Tv, Users, Film } from 'lucide-react'
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
  const description = profile?.bio?.slice(0, 160) ?? `Watch food videos from @${params.username} on HapiEats TV.`
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

export default async function ProfilePage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, is_creator, is_verified_chef, role, created_at')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  const isOwnProfile = user?.id === profile.id

  // Fetch this user's public videos
  const { data: videos } = await supabase
    .from('videos')
    .select(`
      *,
      channel:channels(id, name, slug, thumbnail_url),
      creator:profiles(id, username, display_name, avatar_url)
    `)
    .eq('creator_id', profile.id)
    .eq('status', 'ready')
    .eq('visibility', 'public')
    .order('published_at', { ascending: false })
    .limit(24)

  // Fetch their channels
  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, slug, thumbnail_url, subscriber_count, description')
    .eq('creator_id', profile.id)
    .limit(6)

  const joinedYear = new Date(profile.created_at).getFullYear()

  return (
    <AppShell>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile header */}
        <div className="flex items-start gap-6 mb-8 flex-wrap">
          <Avatar className="h-20 w-20 md:h-28 md:w-28 shrink-0">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-white text-2xl">
              {profile.display_name?.charAt(0) ?? profile.username?.charAt(0) ?? 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{profile.display_name ?? profile.username}</h1>
              {(profile as typeof profile & { is_verified_chef?: boolean }).is_verified_chef && (
                <VerifiedChefBadge showLabel />
              )}
              {profile.is_creator && (
                <Badge variant="outline" className="text-primary border-primary/40 text-xs">Creator</Badge>
              )}
              {profile.role === 'admin' && (
                <Badge variant="outline" className="text-yellow-500 border-yellow-500/40 text-xs">Admin</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">@{profile.username}</p>

            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Film className="h-4 w-4" />
                {videos?.length ?? 0} videos
              </span>
              {channels && channels.length > 0 && (
                <span className="flex items-center gap-1">
                  <Tv className="h-4 w-4" />
                  {channels.length} channel{channels.length !== 1 ? 's' : ''}
                </span>
              )}
              <span>Joined {joinedYear}</span>
            </div>

            {profile.bio && (
              <p className="mt-3 text-sm leading-relaxed max-w-2xl">{profile.bio}</p>
            )}

            <div className="mt-4 flex gap-2 flex-wrap">
              {isOwnProfile ? (
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link href="/dashboard/settings">
                    <Settings className="h-4 w-4" />
                    Edit Profile
                  </Link>
                </Button>
              ) : null}
              {profile.is_creator && channels && channels.length > 0 && (
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href={`/channel/${channels[0].slug}`}>
                    <Tv className="h-4 w-4" />
                    View Channel
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Channels */}
        {channels && channels.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Tv className="h-5 w-5 text-primary" />
              Channels
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {channels.map(ch => (
                <Link
                  key={ch.id}
                  href={`/channel/${ch.slug}`}
                  className="p-4 rounded-xl border bg-card hover:bg-muted/40 transition-colors group"
                >
                  <p className="font-semibold group-hover:text-primary transition-colors">{ch.name}</p>
                  {ch.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{ch.description}</p>
                  )}
                  {ch.subscriber_count != null && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {ch.subscriber_count.toLocaleString()} subscribers
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Videos */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Videos
          </h2>
          {(videos?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">No public videos yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
