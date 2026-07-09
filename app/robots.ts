import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = 'https://www.hapieatstv.com'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/studio/',
          '/settings',
          '/dashboard/',
          '/creator/',
          '/(auth)/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/tokens',
          '/flavor',
        ],
      },
      // Block AI training crawlers
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'CCBot', 'anthropic-ai', 'Claude-Web', 'Omgilibot', 'FacebookBot'],
        disallow: '/',
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
