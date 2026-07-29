'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Film, Info, Clapperboard, Tv, Gift, BookOpen, ChefHat } from 'lucide-react'
import { cn } from '@/lib/utils'
import VideoCard from '@/components/video/VideoCard'
import { type ProfileClip } from '@/components/profile/ClipsGrid'
import ClipsGrid from '@/components/profile/ClipsGrid'
import { type ProfileData } from '@/components/profile/ProfileHero'
import FlavorProfileCard from '@/components/profile/FlavorProfileCard'
import CreatorGoalThermometer from '@/components/profile/CreatorGoalThermometer'
import { formatViews } from '@/lib/utils'
import type { Video } from '@/types'

// ─── Tabs ────────────────────────────────────────────────────────────

type TabId = 'videos' | 'clips' | 'recipes' | 'classes' | 'goals' | 'about'

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
  goals?: any[]
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'videos', label: 'Videos', icon: <Film className="h-4 w-4" /> },
  { id: 'clips', label: 'Clips', icon: <Clapperboard className="h-4 w-4" /> },
  { id: 'recipes', label: 'Recipes', icon: <ChefHat className="h-4 w-4" /> },
  { id: 'classes', label: 'Classes', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'goals', label: 'Goals', icon: <Gift className="h-4 w-4" /> },
  { id: 'about', label: 'About', icon: <Info className="h-4 w-4" /> },
]

export default function ProfileTabs({ profile, videos, clips, channels, goals = [] }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('videos')

  return (
    <div className="px-4 sm:px-6 mt-8">
      {/* ── Tab Bar ────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-all relative whitespace-nowrap shrink-0',
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80',
            )}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-pink-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Videos Tab ─────────────────────────────────────────── */}
      {activeTab === 'videos' && (
        <section>
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
      )}

      {/* ── Clips Tab ──────────────────────────────────────────── */}
      {activeTab === 'clips' && (
        <section>
          {clips.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">✂️</div>
              <p className="text-muted-foreground font-medium">No clips yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Short highlights and quick recipe moments will appear here
              </p>
            </div>
          ) : (
            <ClipsGrid clips={clips} />
          )}
        </section>
      )}

      {/* ── Recipe Box Tab ─────────────────────────────────────── */}
      {activeTab === 'recipes' && (
        <section className="space-y-6">
          <FlavorProfileCard
            flavorProfile={profile.flavorProfile}
            displayName={profile.displayName ?? profile.username}
          />
          <div className="rounded-3xl border border-foreground/5 bg-card/50 backdrop-blur-sm p-6">
            <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-cyan-400" />
              Recipe Box
            </h3>
            <p className="text-sm text-muted-foreground">
              Interactive recipes from {profile.displayName ?? profile.username}&apos;s videos will appear here. Open a video and tap the recipe sheet to get started!
            </p>
          </div>
        </section>
      )}

      {/* ── Classes Tab ────────────────────────────────────────── */}
      {activeTab === 'classes' && (
        <section>
          {channels.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-muted-foreground font-medium">No classes yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Cooking classes and courses will appear here
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-foreground/5 bg-card/50 backdrop-blur-sm p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-cyan-400" />
                Classes &amp; Courses
              </h3>
              <p className="text-sm text-muted-foreground">
                Browse {profile.displayName ?? profile.username}&apos;s channels for classes and courses.
              </p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {channels.map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/channel/${ch.slug}`}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 hover:border-cyan-500/20 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-pink-500/20 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                      {ch.thumbnail_url ? (
                        <img src={ch.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Tv className="h-5 w-5 text-cyan-400/60" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors truncate">{ch.name}</p>
                      {ch.subscriber_count != null && (
                        <p className="text-xs text-muted-foreground">{formatViews(ch.subscriber_count)} subscribers</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Goals Tab ──────────────────────────────────────────── */}
      {activeTab === 'goals' && (
        <section>
          <CreatorGoalThermometer goals={goals} creatorName={profile.displayName ?? profile.username} />
        </section>
      )}

      {/* ── About Tab ──────────────────────────────────────────── */}
      {activeTab === 'about' && (
        <div className="max-w-3xl space-y-8">
          {profile.bio && (
            <section className="rounded-3xl border border-foreground/5 bg-card/50 backdrop-blur-sm p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</h3>
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{profile.bio}</p>
            </section>
          )}

          <section className="rounded-3xl border border-foreground/5 bg-card/50 backdrop-blur-sm p-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Kitchen Stats</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Followers', value: formatViews(profile.followerCount ?? 0), icon: '👥' },
                { label: 'Total Views', value: formatViews(profile.totalViews), icon: '👀' },
                { label: 'Videos', value: String(profile.videoCount), icon: '🎥' },
                { label: 'Clips', value: String(profile.clipCount), icon: '✂️' },
                { label: 'Channels', value: String(profile.channelCount), icon: '📺' },
                { label: 'Member Since', value: new Date(profile.createdAt).getFullYear().toString(), icon: '📅' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-foreground/5 bg-card/30 p-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold mt-0.5">
                    <span className="mr-1">{stat.icon}</span>{stat.value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
