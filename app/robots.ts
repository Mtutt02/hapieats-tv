import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/studio/',
          '/dashboard/',
          '/settings',
          '/auth/',
          '/tokens',
          '/flavor',
        ],
      },
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/studio/',
          '/dashboard/',
          '/registry/',
        ],
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/studio/',
          '/dashboard/',
          '/registry/',
        ],
      },
      {
        userAgent: 'Claude-Web',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/studio/',
          '/dashboard/',
          '/registry/',
        ],
      },
      {
        userAgent: 'CCBot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/studio/',
          '/dashboard/',
          '/registry/',
        ],
      },
    ],
    sitemap: 'https://hapieatstv.com/sitemap.xml',
  }
}
