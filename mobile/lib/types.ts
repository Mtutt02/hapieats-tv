// Shared types — mirrored from ../types/index.ts (web app). Keep in sync.

export interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  is_creator: boolean
  platform_subscription_status: string | null
}

export interface Channel {
  id: string
  creator_id: string
  name: string
  slug: string
  thumbnail_url: string | null
}

export interface Video {
  id: string
  channel_id: string | null
  creator_id: string
  title: string
  description: string | null
  mux_playback_id: string | null
  thumbnail_url: string | null
  duration: number | null
  status: 'uploading' | 'processing' | 'ready' | 'errored'
  visibility: 'public' | 'private' | 'unlisted'
  view_count: number
  like_count?: number
  created_at: string
  published_at: string | null
  channel?: Channel
  creator?: Profile
}

export interface LiveStream {
  id: string
  channel_id: string
  creator_id: string
  title: string
  description: string | null
  mux_playback_id: string | null
  stream_key?: string
  status: 'idle' | 'active' | 'ended'
  viewer_count: number
  channel?: Channel
  creator?: Profile
}

export interface ChatMessage {
  id: string
  stream_id: string
  sender_id: string
  message: string
  type: 'message' | 'gift_event' | 'system'
  gift_name?: string | null
  gift_emoji?: string | null
  gift_tokens?: number | null
  is_private: boolean
  created_at: string
  sender?: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface LiveGift {
  id: string
  name: string
  emoji: string
  token_cost: number
  display_priority: number
  animation_key: string | null
}

export interface RecipeCard {
  id: string
  video_id: string
  title: string
  ingredients: string[]
  steps: string[]
  cook_time_minutes: number | null
  servings: number | null
}

// TV channel model — mirrors TVBrowser.tsx
export interface TVPlaylistItem {
  title: string
  muxPlaybackId: string
  duration: number | null
}

export interface TVChannel {
  number: number
  name: string
  icon: string
  description: string
  category: string
  currentTitle: string
  playlist?: TVPlaylistItem[]
  muxPlaybackId?: string
  isLive?: boolean
}

export const muxHls = (playbackId: string) => `https://stream.mux.com/${playbackId}.m3u8`
export const muxThumb = (playbackId: string, w = 640) =>
  `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${w}&fit_mode=smartcrop`
