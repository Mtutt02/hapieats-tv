import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import VideoGrid from '@/components/video/VideoGrid'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users } from 'lucide-react'
import ChannelSubscribeButton from '@/components/video/ChannelSubscribeButton'
import type { Video } from '@/types'

interface PageProps {
  params: { username: string }
}

export default async function ChannelPage({ params }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Look up by channel slug first (primary use case: /channel/my-channel-slug)
  const { data: channelBySlug } = await supabase
    .from('channels')
    .select(`
      *,
      creator:profiles(id, username, display_name, avatar_url, bio, banner_url)
    `)
    .eq('slug', params.username)
    .single()

  // ── Fallback: look up by creator username (legacy/profile links)
  const { data: profileByUsername } = channelBySlug
    ? { data: null }
    : await supabase
        .from('profiles')
        .select('*, channels(*)')
        .eq('username', params.username)
        .single()

  // Resolve channel + profile from whichever lookup worked
  let channel: any = null
  let profile: any = null

  if (channelBySlug) {
    channel = channelBySlug
    profile = channelBySlug.creator
  } else if (profileByUsername) {
    profile = profileByUsername
    channel = profileByUsername.channels?.[0] ?? null
  } else {
    notFound()
  }

  if (!profile) notFound()

  const { data: videos } = await supabase
    .from('videos')
    .select('*, channel:channels(id, name, slug), creator:profiles(id, username, display_name, avatar_url)')
    .eq('creator_id', profile.id)
    .eq('status', 'ready')
    .eq('visibility', 'public')
    .order('published_at', { ascending: false })

  // Check if current user is subscribed
  let isSubscribed = false
  if (user && channel) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', user.id)
      .eq('channel_id', channel.id)
      .eq('status', 'active')
      .single()
    isSubscribed = !!sub
  }

  return (
    <AppShell>
      {/* Banner */}
      <div className="h-36 md:h-52 bg-gradient-to-r from-primary/20 to-orange-100 relative overflow-hidden">
        {profile.banner_url && (
          <img src={profile.banner_url} alt="Channel banner" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Channel header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end -mt-10 mb-8">
          <Avatar className="h-24 w-24 border-4 border-background ring-2 ring-primary">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-white text-2xl">
              {profile.display_name?.charAt(0) ?? profile.username.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 pt-2 sm:pt-0">
            <h1 className="text-2xl font-bold">{channel?.name ?? profile.display_name ?? profile.username}</h1>
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
            {channel && (
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{(channel.subscriber_count ?? 0).toLocaleString()} subscribers</span>
                <span>·</span>
                <span>{channel.video_count ?? 0} videos</span>
              </div>
            )}
          </div>
          {channel && user?.id !== profile.id && (
            <ChannelSubscribeButton
              channel={channel}
              userId={user?.id ?? null}
              isSubscribed={isSubscribed}
            />
          )}
        </div>

        {profile.bio && <p className="text-muted-foreground mb-8 max-w-2xl">{profile.bio}</p>}

        <VideoGrid videos={(videos as Video[]) ?? []} emptyMessage="No public videos yet." />
      </div>
    </AppShell>
  )
}
