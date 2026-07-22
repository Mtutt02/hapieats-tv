import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

const BASE = 'https://www.hapieatstv.com'

// Static public pages
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
  { url: `${BASE}/trending`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
  { url: `${BASE}/live`, lastModified: new Date(), changeFrequency: 'always', priority: 0.9 },
  { url: `${BASE}/classes`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
  { url: `${BASE}/stations`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
  { url: `${BASE}/global-foods`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE}/search`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE}/tv`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  { url: `${BASE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  { url: `${BASE}/guidelines`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  { url: `${BASE}/creator-agreement`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const service = createServiceClient()

    // Public videos (non-flagged, ready, public visibility)
    const { data: videos } = await service
      .from('videos')
      .select('id, updated_at')
      .eq('status', 'ready')
      .eq('visibility', 'public')
      .eq('is_flagged', false)
      .neq('is_clip', true)
      .order('created_at', { ascending: false })
      .limit(500)

    // Public creator profiles
    const { data: profiles } = await service
      .from('profiles')
      .select('username, updated_at')
      .eq('is_creator', true)
      .is('suspended_at', null)
      .order('created_at', { ascending: false })
      .limit(300)

    // Published courses
    const { data: courses } = await service
      .from('courses')
      .select('id, updated_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(200)

    const videoPages: MetadataRoute.Sitemap = (videos ?? []).map(v => ({
      url: `${BASE}/watch/${v.id}`,
      lastModified: v.updated_at ? new Date(v.updated_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

    const profilePages: MetadataRoute.Sitemap = (profiles ?? []).map(p => ({
      url: `${BASE}/profile/${p.username}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }))

    const coursePages: MetadataRoute.Sitemap = (courses ?? []).map(c => ({
      url: `${BASE}/academy/course/${c.id}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    }))

    return [...STATIC_PAGES, ...videoPages, ...profilePages, ...coursePages]
  } catch {
    // Fallback to static pages only if DB is unavailable
    return STATIC_PAGES
  }
}
