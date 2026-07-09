import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import ClipsFeed from '@/components/clips/ClipsFeed'
import { createServiceClient } from '@/lib/supabase/server'
import { type Clip, type ClipCategory, CLIP_CATEGORIES, clipThumbnail } from '@/lib/clips/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { clipId: string }
}

/** Fetch a single clip and map the row onto the shared Clip contract. */
async function getClip(clipId: string): Promise<Clip | null> {
  const supabase = createServiceClient()
  const { data: row } = await supabase
    .from('videos')
    .select('*, creator:profiles(id, username, display_name, avatar_url)')
    .eq('id', clipId)
    .eq('status', 'ready')
    .eq('visibility', 'public')
    .single()

  if (!row || !row.mux_playback_id) return null

  const creator = (row.creator as {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
  } | null) ?? null

  const rawCategory = (row as Record<string, unknown>).clip_category
  const category: ClipCategory | null = CLIP_CATEGORIES.includes(rawCategory as ClipCategory)
    ? (rawCategory as ClipCategory)
    : null

  return {
    id: row.id,
    title: row.title ?? 'Untitled clip',
    description: row.description ?? null,
    mux_playback_id: row.mux_playback_id,
    duration: row.duration ?? null,
    clip_category: category,
    view_count: row.view_count ?? 0,
    like_count: row.like_count ?? 0,
    comment_count: ((row as Record<string, unknown>).comment_count as number | undefined) ?? 0,
    created_at: row.created_at,
    creator: {
      id: creator?.id ?? '',
      username: creator?.username ?? 'unknown',
      display_name: creator?.display_name ?? null,
      avatar_url: creator?.avatar_url ?? null,
    },
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const clip = await getClip(params.clipId)
  if (!clip) {
    return { title: 'Clip not found — HapiEats TV' }
  }
  const ogImage = clipThumbnail(clip.mux_playback_id)
  return {
    title: `${clip.title} — Clips — HapiEats TV`,
    description: clip.description ?? `Watch “${clip.title}” by @${clip.creator.username} on HapiEats TV.`,
    openGraph: {
      title: clip.title,
      description: clip.description ?? `A clip by @${clip.creator.username} on HapiEats TV`,
      images: [{ url: ogImage }],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title: clip.title,
      images: [ogImage],
    },
  }
}

export default async function ClipDeepLinkPage({ params }: PageProps) {
  const clip = await getClip(params.clipId)
  if (!clip) notFound()

  return (
    <AppShell fullWidth>
      <ClipsFeed initialClipId={clip.id} initialClip={clip} />
    </AppShell>
  )
}
