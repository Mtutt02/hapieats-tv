'use client'

import React from 'react'
import { formatViews } from '@/lib/utils'

interface ProfileStatsProps {
  followerCount: number | null
  videoCount: number
  clipCount: number
  channelCount: number
  totalDuration: number  // seconds
  totalViews: number
}

/** Format seconds into a readable "cooking time" string */
function formatDurationCooking(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours >= 24) return `${(hours / 24).toFixed(0)}d`
  if (hours > 0) return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`
  return `${minutes}m`
}

export default function ProfileStats({
  followerCount,
  videoCount,
  clipCount,
  channelCount,
  totalDuration,
  totalViews,
}: ProfileStatsProps) {
  const stats = [
    {
      icon: '🔥',
      label: 'Flame Score',
      value: formatViews((followerCount ?? 0) * 10 + totalViews + videoCount * 50),
      sub: 'creator influence',
    },
    {
      icon: '🍳',
      label: 'Dishes',
      value: formatViews(videoCount),
      sub: 'recipes & more',
    },
    {
      icon: '⏱️',
      label: 'Kitchen Time',
      value: formatDurationCooking(totalDuration),
      sub: 'total cook time',
    },
    {
      icon: '🎬',
      label: 'Clips',
      value: formatViews(clipCount),
      sub: 'quick bites',
    },
  ]

  return (
    <div className="px-4 sm:px-6 mt-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative group rounded-2xl border border-foreground/5 bg-card/50 backdrop-blur-sm p-4 hover:bg-card/80 hover:border-primary/20 transition-all duration-300"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{stat.icon}</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold mt-1.5 tracking-tight">
              {stat.value}
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-medium">
              {stat.sub}
            </p>
            {/* Hover glow */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-primary/5 to-transparent" />
          </div>
        ))}
      </div>
    </div>
  )
}
