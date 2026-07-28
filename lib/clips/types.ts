// ============================================================
// HapiEats TV — Clips shared contracts
// Single source of truth for the Clips module. All Clips API
// routes and UI components import these types.
// ============================================================

export const CLIP_MAX_SECONDS = 90
export const CLIP_CATEGORIES = ['food', 'lifestyle', 'travel', 'wellness', 'fitness', 'entertainment', 'other'] as const
export type ClipCategory = typeof CLIP_CATEGORIES[number]

export type ClipsFeedKind = 'foryou' | 'following' | 'trending'

export interface ClipCreator {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  follower_count?: number
}

export interface Clip {
  id: string
  title: string
  description: string | null
  mux_playback_id: string
  duration: number | null
  clip_category: ClipCategory | null
  view_count: number
  like_count: number
  comment_count: number
  created_at: string
  creator: ClipCreator
  /** populated for authed callers */
  liked?: boolean
  following?: boolean
}

/**
 * GET /api/clips?feed=foryou|following|trending&cursor=<iso>&limit=10&category=<cat>
 * → { clips: Clip[], nextCursor: string | null }
 *
 * POST /api/clips/[clipId]/view → { success: true }   (rate limited, increments view_count)
 *
 * GET    /api/users/follow            → { following: string[] }        (creator ids)
 * POST   /api/users/follow  {creatorId} → { success: true }
 * DELETE /api/users/follow?creatorId=  → { success: true }
 *
 * Likes and comments reuse the existing video endpoints:
 *   POST /api/videos/[videoId]/like · /api/videos/[videoId]/comments
 */
export interface ClipsFeedResponse {
  clips: Clip[]
  nextCursor: string | null
}

export function clipThumbnail(playbackId: string, time = 1): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=540&fit_mode=preserve&time=${time}`
}

export function clipShareUrl(clipId: string): string {
  return `https://www.hapieatstv.com/clips/${clipId}`
}
