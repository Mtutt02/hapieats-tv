import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  CLIP_CATEGORIES,
  type Clip,
  type ClipCategory,
  type ClipsFeedKind,
  type ClipsFeedResponse,
} from '@/lib/clips/types'

export const dynamic = 'force-dynamic'

const FEED_KINDS: ClipsFeedKind[] = ['foryou', 'following', 'trending']
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 30

// Only public-safe columns — never stream keys, pricing internals, or upload ids.
const CLIP_SELECT =
  'id, title, description, mux_playback_id, duration, clip_category, ' +
  'view_count, like_count, comment_count, created_at, creator_id, ' +
  'creator:profiles(id, username, display_name, avatar_url, follower_count)'

interface RawCreator {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  follower_count?: number
}

interface RawClipRow {
  id: string
  title: string
  description: string | null
  mux_playback_id: string
  duration: number | null
  clip_category: ClipCategory | null
  view_count: number | null
  like_count: number | null
  comment_count: number | null
  created_at: string
  creator_id: string
  creator: RawCreator | RawCreator[] | null
}

function toClip(row: RawClipRow): Clip {
  const rawCreator = Array.isArray(row.creator) ? row.creator[0] : row.creator
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    mux_playback_id: row.mux_playback_id,
    duration: row.duration,
    clip_category: row.clip_category,
    view_count: row.view_count ?? 0,
    like_count: row.like_count ?? 0,
    comment_count: row.comment_count ?? 0,
    created_at: row.created_at,
    creator: {
      id: rawCreator?.id ?? row.creator_id,
      username: rawCreator?.username ?? 'unknown',
      display_name: rawCreator?.display_name ?? null,
      avatar_url: rawCreator?.avatar_url ?? null,
      follower_count: rawCreator?.follower_count ?? 0,
    },
  }
}

/** Engagement score for the For You feed. */
function engagementScore(clip: Clip): number {
  const hoursOld = (Date.now() - new Date(clip.created_at).getTime()) / 3_600_000
  const recencyBonus = hoursOld < 24 ? 50 : 0
  return clip.like_count * 3 + clip.comment_count * 4 + clip.view_count * 0.05 + recencyBonus
}

const EMPTY: ClipsFeedResponse = { clips: [], nextCursor: null }

// GET /api/clips?feed=foryou|following|trending&cursor=<iso>&limit=10&category=<cat>
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const feedParam = params.get('feed') ?? 'foryou'
  if (!FEED_KINDS.includes(feedParam as ClipsFeedKind)) {
    return NextResponse.json({ error: 'Invalid feed' }, { status: 400 })
  }
  const feed = feedParam as ClipsFeedKind

  const categoryParam = params.get('category')
  if (categoryParam && !CLIP_CATEGORIES.includes(categoryParam as ClipCategory)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  const category = categoryParam as ClipCategory | null

  const cursorParam = params.get('cursor')
  if (cursorParam && Number.isNaN(Date.parse(cursorParam))) {
    return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
  }
  const cursor = cursorParam

  const limitParam = Number.parseInt(params.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Number.isNaN(limitParam) ? DEFAULT_LIMIT : Math.min(Math.max(limitParam, 1), MAX_LIMIT)

  // Optional auth — required only for the Following feed.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (feed === 'following' && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  // Following feed needs the followed creator ids first.
  let followedIds: string[] = []
  if (feed === 'following' && user) {
    const { data: follows, error: followsError } = await service
      .from('creator_follows')
      .select('creator_id')
      .eq('follower_id', user.id)
    if (followsError) {
      // creator_follows table may not exist yet — degrade gracefully
      return NextResponse.json(EMPTY)
    }
    followedIds = (follows ?? []).map((f: { creator_id: string }) => f.creator_id)
    if (followedIds.length === 0) {
      return NextResponse.json(EMPTY)
    }
  }

  let query = service
    .from('videos')
    .select(CLIP_SELECT)
    .eq('is_clip', true)
    .eq('status', 'ready')
    .eq('visibility', 'public')
    .not('mux_playback_id', 'is', null)
    .order('created_at', { ascending: false })

  if (category) query = query.eq('clip_category', category)
  if (cursor) query = query.lt('created_at', cursor)

  if (feed === 'following') {
    query = query.in('creator_id', followedIds).limit(limit)
  } else if (feed === 'trending') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString()
    query = query.gte('created_at', sevenDaysAgo).limit(limit * 3)
  } else {
    // foryou — over-fetch recent rows, score in JS below
    query = query.limit(limit * 3)
  }

  const { data, error } = await query
  if (error) {
    // is_clip column may not exist yet (migration not applied) — degrade gracefully
    return NextResponse.json(EMPTY)
  }

  const rows = (data ?? []) as unknown as RawClipRow[]
  let clips = rows.map(toClip)

  if (feed === 'foryou') {
    clips = clips.sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, limit)
  } else if (feed === 'trending') {
    clips = clips
      .sort((a, b) => b.view_count + b.like_count - (a.view_count + a.like_count))
      .slice(0, limit)
  }

  // Authed callers get liked / following booleans.
  if (user && clips.length > 0) {
    const clipIds = clips.map((c) => c.id)
    const creatorIds = Array.from(new Set(clips.map((c) => c.creator.id)))

    const [likesResult, followsResult] = await Promise.all([
      service.from('video_likes').select('video_id').eq('user_id', user.id).in('video_id', clipIds),
      service.from('creator_follows').select('creator_id').eq('follower_id', user.id).in('creator_id', creatorIds),
    ])

    const likedIds = new Set(
      (likesResult.data ?? []).map((l: { video_id: string }) => l.video_id)
    )
    const followingIds = new Set(
      (followsResult.data ?? []).map((f: { creator_id: string }) => f.creator_id)
    )

    clips = clips.map((c) => ({
      ...c,
      liked: likedIds.has(c.id),
      following: followingIds.has(c.creator.id),
    }))
  }

  const response: ClipsFeedResponse = {
    clips,
    nextCursor: clips.length > 0 ? clips[clips.length - 1].created_at : null,
  }
  return NextResponse.json(response)
}
