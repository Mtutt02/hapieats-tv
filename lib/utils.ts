import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`
  return String(views)
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatDistanceOrDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 7) {
    // Use relative time
    const diffSecs = Math.floor(diffMs / 1000)
    if (diffSecs < 60) return 'just now'
    const diffMins = Math.floor(diffSecs / 60)
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffDays)}d ago`
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getVideoThumbnail(muxPlaybackId: string | null, thumbnailUrl: string | null, seedId?: string): string {
  if (thumbnailUrl) return thumbnailUrl
  if (muxPlaybackId) {
    // Vary the thumbnail capture time per video so cards look distinct (0–45 s range)
    const offset = seedId ? (seedId.charCodeAt(0) + seedId.charCodeAt(1)) % 45 : 5
    return `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?width=640&time=${offset}`
  }
  return '/placeholder-video.jpg'
}

export function getVideoAnimatedPreview(muxPlaybackId: string | null, seedId?: string): string | null {
  if (!muxPlaybackId) return null
  // Stagger clip start times so each preview shows a different moment
  const start = seedId ? ((seedId.charCodeAt(0) + seedId.charCodeAt(2)) % 40) + 2 : 5
  const end = start + 10
  return `https://image.mux.com/${muxPlaybackId}/animated.gif?width=480&fps=15&start=${start}&end=${end}`
}
