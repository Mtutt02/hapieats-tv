export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'errored'
export type VideoVisibility = 'public' | 'private' | 'unlisted'
export type PricingModel = 'free' | 'pay_per_view' | 'subscription'

export interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  is_creator: boolean
  stripe_account_id: string | null
  stripe_customer_id: string | null
  platform_subscription_id: string | null
  platform_subscription_status: string | null
  created_at: string
  updated_at: string
}

export interface Channel {
  id: string
  creator_id: string
  name: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  stripe_price_id: string | null
  subscription_price: number | null
  subscriber_count: number
  video_count: number
  created_at: string
  updated_at: string
  // joined
  creator?: Profile
}

export type PostType = 'channel' | 'general' | 'post'

export interface Video {
  id: string
  channel_id: string | null   // nullable — general posts have no channel
  creator_id: string
  title: string
  description: string | null
  mux_asset_id: string | null
  mux_playback_id: string | null
  mux_upload_id: string | null
  thumbnail_url: string | null
  duration: number | null
  status: VideoStatus
  visibility: VideoVisibility
  pricing_model: PricingModel
  price: number | null
  stripe_price_id: string | null
  post_type: PostType
  tags: string[] | null
  station_id: string | null
  clip_start: number | null
  clip_end: number | null
  view_count: number
  like_count?: number
  comment_count?: number
  created_at: string
  updated_at: string
  published_at: string | null
  // joined
  channel?: Channel
  creator?: Profile
  user_has_access?: boolean
}

export interface Subscription {
  id: string
  subscriber_id: string
  channel_id: string
  stripe_subscription_id: string
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  current_period_end: string
  created_at: string
}

export interface Purchase {
  id: string
  buyer_id: string
  video_id: string
  stripe_payment_intent_id: string
  amount: number
  created_at: string
}

export interface CreatorStats {
  total_views: number
  total_revenue: number
  subscriber_count: number
  video_count: number
  views_this_month: number
  revenue_this_month: number
}

export interface Comment {
  id: string
  video_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
  author?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
}

export interface LiveStream {
  id: string
  channel_id: string
  creator_id: string
  title: string
  description: string | null
  mux_live_stream_id: string
  mux_playback_id: string | null
  stream_key: string
  status: 'idle' | 'active' | 'ended'
  viewer_count: number
  started_at: string | null
  ended_at: string | null
  recording_asset_id: string | null
  created_at: string
  channel?: Channel
  creator?: Profile
}

export interface Class {
  id: string
  instructor_id: string
  channel_id: string
  title: string
  description: string | null
  category: string
  skill_level: string
  type: 'live' | 'recorded' | 'series'
  price: number
  stripe_price_id: string | null
  max_students: number | null
  scheduled_at: string | null
  live_stream_id: string | null
  thumbnail_url: string | null
  is_published: boolean
  enrollment_count: number
  created_at: string
  updated_at: string
  // Joins
  instructor?: Profile
  channel?: Channel
  lessons?: ClassLesson[]
  isEnrolled?: boolean
}

export interface ClassLesson {
  id: string
  class_id: string
  title: string
  description: string | null
  video_id: string | null
  order_index: number
  is_free_preview: boolean
  duration: number | null
  created_at: string
  updated_at: string
  video?: Video
}

export interface ClassEnrollment {
  id: string
  class_id: string
  user_id: string
  stripe_payment_intent_id: string | null
  status: 'active' | 'canceled' | 'refunded'
  progress_lesson_id: string | null
  enrolled_at: string
}
