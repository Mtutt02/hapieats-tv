'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Film, Info, Clapperboard, Users, Tv, MapPin, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import VideoCard from '@/components/video/VideoCard'
import type { Video } from '@/types'
import type { ProfileClip } from '@/components/profile/ClipsGrid'
import ClipsGrid from '@/components/profile/ClipsGrid'
import type { ProfileData } from '@/components/profile/ProfileHero'
import { formatViews } from '@/lib/utils'

// ─── Tabs ────────────────────────────────────────────────────────────

type TabId = 'library' | 'about'

interface ProfileTabsProps {
  profile: ProfileData
  videos: Video[]
  clips: ProfileClip[]
  channels: Array<{
    id: string
    name: string
    slug: string
    thumbnail_url: string | null
    subscriber_count: number | null
    description: string | null
  }>
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'library', label: 'Library', icon: <Film className="h-4 w-4" /> },
  { id: 'about', label: 'About', icon: <Info className="h-4 w-4" /> },
]

export default function ProfileTabs({ profile, videos, clips, channels }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('library')

  return (
    <div className="px-4 sm:px-6 mt-8">
      {/* ── Tab Bar ────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative',
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80',
            )}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Library Tab ────────────────────────────────────────── */}
      {activeTab === 'library' && (
        <div>
          {/* Clips Row */}
          {clips.length > 0 && (
            <section className="mb-10">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-primary" />
                Quick Bites
                <span className="text-xs font-normal text-muted-foreground/60">({clips.length})</span>
              </h3>
              <ClipsGrid clips={clips} />
            </section>
          )}

          {/* Video Grid */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              Full Recipes
              <span className="text-xs font-normal text-muted-foreground/60">({videos.length})</span>
            </h3>
            {videos.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🍳</div>
                <p className="text-muted-foreground font-medium">No dishes served yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  When {profile.displayName ?? profile.username} posts videos, they&apos;ll show up here
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {videos.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── About Tab ──────────────────────────────────────────── */}
      {activeTab === 'about' && (
        <div className="max-w-3xl space-y-8">
          {/* Bio */}
          {profile.bio && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                About
              </h3>
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
                {profile.bio}
              </p>
            </section>
          )}

          {/* Extended Stats */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Kitchen Stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Followers', value: formatViews(profile.followerCount ?? 0), icon: '👥' },
                { label: 'Total Views', value: formatViews(profile.totalViews), icon: '👀' },
                { label: 'Videos', value: String(profile.videoCount), icon: '🎥' },
                { label: 'Clips', value: String(profile.clipCount), icon: '✂️' },
                { label: 'Channels', value: String(profile.channelCount), icon: '📺' },
                { label: 'Member Since', value: new Date(profile.createdAt).getFullYear().toString(), icon: '📅' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-foreground/5 bg-card/30 p-3"
                >
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold mt-0.5">
                    <span className="mr-1">{stat.icon}</span>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Channels */}
          {channels.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Tv className="h-4 w-4 text-primary" />
                Channels
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {channels.map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/channel/${ch.slug}`}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 hover:border-primary/20 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                      {ch.thumbnail_url ? (
                        <img src={ch.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Tv className="h-5 w-5 text-primary/60" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                        {ch.name}
                      </p>
                      {ch.subscriber_count != null && (
                        <p className="text-xs text-muted-foreground">
                          {formatViews(ch.subscriber_count)} subscribers
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Location / Website */}
          {(profile.location || profile.website) && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Links
              </h3>
              <div className="space-y-2">
                {profile.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.website && (
                  <a
                    href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    {profile.website}
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
