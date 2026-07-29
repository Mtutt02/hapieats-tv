'use client'

import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import FollowButton from '@/components/profile/FollowButton'
import VerifiedChefBadge from '@/components/badges/VerifiedChefBadge'
import { Settings, Tv, MapPin, Link as LinkIcon, Calendar, Gift, Flame } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

export interface ProfileData {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  coverUrl: string | null
  bio: string | null
  isCreator: boolean
  isVerifiedChef: boolean
  role: string | null
  createdAt: string
  followerCount: number | null
  cuisineTags: string[]
  location: string | null
  website: string | null
  totalViews: number
  totalDuration: number
  videoCount: number
  clipCount: number
  channelCount: number
  flavorProfile?: FlavorProfileData | null
  streakCount?: number
  isLive?: boolean
}

export interface FlavorProfileData {
  cuisines?: string[]
  dietary_tags?: string[]
  heat_level?: number
  comfort_level?: number
  skill_level?: number
  signature_ingredients?: string[]
  preferred_methods?: string[]
}

interface ProfileHeroProps {
  profile: ProfileData
  isOwnProfile: boolean
  isSignedIn: boolean
  initialFollowing: boolean
  channelSlug?: string
  stationName?: string
}

// ─── Color helpers ────────────────────────────────────────────────────

function nameGradient(name: string): string {
  const colors = [
    'from-orange-500 via-red-500 to-pink-500',
    'from-emerald-500 via-teal-500 to-cyan-500',
    'from-violet-500 via-purple-500 to-fuchsia-500',
    'from-amber-500 via-orange-500 to-red-500',
    'from-sky-500 via-blue-500 to-indigo-500',
    'from-rose-500 via-pink-500 to-purple-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

const CUISINE_EMOJI: Record<string, string> = {
  italian: '🍝', japanese: '🍣', mexican: '🌮', indian: '🍛',
  chinese: '🥟', thai: '🍜', korean: '🥘', vietnamese: '🍜',
  american: '🍔', mediterranean: '🫒', bbq: '🔥', baking: '🥐',
  dessert: '🍫', vegan: '🌱', seafood: '🦐', steak: '🥩',
  breakfast: '🥞', salad: '🥗', soup: '🍲', sushi: '🍣',
  pasta: '🍝', pizza: '🍕', tacos: '🌮', curry: '🍛',
  'soul food': '🍗', 'comfort food': '🧀', healthy: '🥑',
  'street food': '🌯', 'plant-based': '🌿', quick: '⚡',
}

function getCuisineEmoji(tag: string): string {
  const lower = tag.toLowerCase()
  for (const [key, emoji] of Object.entries(CUISINE_EMOJI)) {
    if (lower.includes(key)) return emoji
  }
  return '🍽️'
}

export default function ProfileHero({
  profile,
  isOwnProfile,
  isSignedIn,
  initialFollowing,
  channelSlug,
  stationName,
}: ProfileHeroProps) {
  const gradient = nameGradient(profile.displayName ?? profile.username)
  const joinedYear = new Date(profile.createdAt).getFullYear()

  const score = (profile.followerCount ?? 0) * 3 + profile.totalViews + profile.videoCount * 100
  const heatLevel = score > 50000 ? 5 : score > 10000 ? 4 : score > 3000 ? 3 : score > 500 ? 2 : 1
  const flames = '🔥'.repeat(heatLevel)

  const initials = (profile.displayName ?? profile.username).charAt(0).toUpperCase()
  const displayName = profile.displayName ?? profile.username

  return (
    <div className="relative">
      {/* ── Cover Image ──────────────────────────────────────────── */}
      <div className="relative h-48 sm:h-64 w-full overflow-hidden rounded-b-3xl">
        {profile.coverUrl ? (
          <img src={profile.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-60`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* LIVE Ribbon */}
        {profile.isLive && (
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/90 backdrop-blur-sm text-white text-xs font-bold animate-pulse shadow-lg shadow-red-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping absolute inline-flex" />
              <span className="h-1.5 w-1.5 rounded-full bg-white relative inline-flex" />
              <span className="tracking-wider">LIVE</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Profile Info Overlay ─────────────────────────────────── */}
      <div className="relative -mt-20 sm:-mt-24 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          {/* Avatar — squircle */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-orange-400 to-red-600 p-[3px] animate-pulse">
              <div className="w-full h-full rounded-3xl bg-background" />
            </div>
            <Avatar className="relative h-24 w-24 sm:h-28 sm:w-28 border-4 border-background rounded-3xl">
              <AvatarImage src={profile.avatarUrl ?? undefined} className="rounded-3xl" />
              <AvatarFallback className="bg-primary/10 text-3xl font-bold text-primary rounded-3xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            {profile.isVerifiedChef && (
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                <VerifiedChefBadge />
              </div>
            )}
          </div>

          {/* Info Column */}
          <div className="flex-1 min-w-0 pb-2">
            {/* Station chip */}
            {stationName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-semibold border border-cyan-500/20 mb-1.5">
                📡 {stationName}
              </span>
            )}

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{displayName}</h1>
              {profile.isVerifiedChef && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold border border-orange-500/20">
                  👨‍🍳 Verified Chef
                </span>
              )}
              {profile.isCreator && (
                <Badge variant="outline" className="text-cyan-400 border-cyan-500/40 text-[10px] font-bold uppercase tracking-wider">
                  PRO
                </Badge>
              )}
              {profile.role === 'admin' && (
                <Badge variant="outline" className="text-yellow-500 border-yellow-500/40 text-xs">⚡ Admin</Badge>
              )}
            </div>

            <p className="text-muted-foreground text-sm mt-0.5">@{profile.username}</p>

            {/* Heat + Streak */}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm tracking-wider" title={`Heat Level ${heatLevel}/5`}>{flames}</span>
              <span className="text-xs text-muted-foreground font-medium">Level {heatLevel} Cook</span>
              {(profile.streakCount ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-orange-400 font-medium">
                  <Flame className="h-3.5 w-3.5" /> {profile.streakCount}-day streak
                </span>
              )}
            </div>

            {/* Cuisine Tags */}
            {profile.cuisineTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {profile.cuisineTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/10 text-xs font-medium hover:bg-foreground/10 transition-colors cursor-default">
                    {getCuisineEmoji(tag)} {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <p className="mt-3 text-sm leading-relaxed text-foreground/80 max-w-2xl line-clamp-3">{profile.bio}</p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs text-muted-foreground">
              {profile.location && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</span>
              )}
              {profile.website && (
                <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                  <LinkIcon className="h-3 w-3" />{profile.website.replace(/^https?:\/\//, '').split('/')[0]}
                </a>
              )}
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Joined {joinedYear}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {isOwnProfile ? (
                <Button asChild variant="default" size="sm" className="gap-2 rounded-full">
                  <Link href="/settings"><Settings className="h-4 w-4" />Edit Profile</Link>
                </Button>
              ) : (
                <>
                  <FollowButton creatorId={profile.id} initialFollowing={initialFollowing} isSignedIn={isSignedIn} />
                  <Button size="sm" variant="outline" className="gap-2 rounded-full border-pink-500/30 text-pink-400 hover:bg-pink-500/10">
                    <Gift className="h-3.5 w-3.5" /> Gift Flavor
                  </Button>
                </>
              )}
              {profile.isCreator && channelSlug && (
                <Button asChild size="sm" variant="outline" className="gap-2 rounded-full">
                  <Link href={`/channel/${channelSlug}`}><Tv className="h-4 w-4" />View Channel</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
