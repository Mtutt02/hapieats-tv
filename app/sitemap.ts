import type { MetadataRoute } from 'next'

const BASE_URL = 'https://hapieatstv.com'

interface PageEntry {
  url: string
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

const staticPages: PageEntry[] = [
  { url: '', priority: 1.0, changeFrequency: 'daily' },
  { url: '/about', priority: 0.6, changeFrequency: 'monthly' },
  { url: '/faq', priority: 0.7, changeFrequency: 'weekly' },
  { url: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  { url: '/tv', priority: 0.8, changeFrequency: 'daily' },
  { url: '/live', priority: 0.7, changeFrequency: 'weekly' },
  { url: '/trending', priority: 0.7, changeFrequency: 'daily' },
  { url: '/stations', priority: 0.6, changeFrequency: 'weekly' },
  { url: '/flavor', priority: 0.5, changeFrequency: 'weekly' },
  { url: '/challenges', priority: 0.6, changeFrequency: 'weekly' },
  { url: '/courses', priority: 0.6, changeFrequency: 'weekly' },
  { url: '/classes', priority: 0.6, changeFrequency: 'weekly' },
  { url: '/search', priority: 0.4, changeFrequency: 'weekly' },
  { url: '/tokens', priority: 0.5, changeFrequency: 'monthly' },
  { url: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { url: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { url: '/guidelines', priority: 0.4, changeFrequency: 'monthly' },
  { url: '/creator-agreement', priority: 0.4, changeFrequency: 'monthly' },
]

const authPages = ['/login', '/register', '/forgot-password', '/reset-password']

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = staticPages.map(p => ({
    url: `${BASE_URL}${p.url}`,
    lastModified: new Date(),
    changeFrequency: p.changeFrequency ?? 'monthly',
    priority: p.priority ?? 0.5,
  }))

  return entries
}
