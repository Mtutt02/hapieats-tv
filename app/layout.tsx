import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import GlobalUploadToast from '@/components/upload/GlobalUploadToast'

const inter = Inter({ subsets: ['latin'] })

// Explicit viewport — prevents mobile browsers from rendering at desktop width
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,   // prevents iOS auto-zoom on input focus
  viewportFit: 'cover', // respect iPhone notch safe areas
}

const BASE_URL = 'https://hapieatstv.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default: 'HapiEats TV', template: '%s | HapiEats TV' },
  description: 'Watch and support food creators on HapiEats TV. Free and premium food videos, live streams, cooking classes, and recipes — all in one place.',
  keywords: [
    'food videos', 'cooking videos', 'food creators', 'food streaming', 'recipes',
    'cooking classes', 'live cooking', 'food network', 'chef videos', 'food content',
    'HapiEats', 'HapiEats TV', 'food community', 'culinary videos',
  ],
  authors: [{ name: 'HapiEats TV', url: BASE_URL }],
  creator: 'HapiEats TV',
  publisher: 'HapiEats TV',
  category: 'Food & Drink',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  alternates: { canonical: BASE_URL },
  openGraph: {
    siteName: 'HapiEats TV',
    title: 'HapiEats TV — Good Food. Real People. Real Stories.',
    description: 'Watch food creators, catch live streams, and take cooking classes. Free and premium content from real food people.',
    type: 'website',
    url: BASE_URL,
    locale: 'en_US',
    // opengraph-image.tsx auto-generates the OG image
  },
  twitter: {
    card: 'summary_large_image',
    site: '@hapieatstv',
    creator: '@hapieatstv',
    title: 'HapiEats TV — Good Food. Real People. Real Stories.',
    description: 'Watch food creators, catch live streams, and take cooking classes.',
    // twitter-image.tsx auto-generates the Twitter image
  },
  icons: {
    // icon.tsx and apple-icon.tsx handle these automatically
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.json',
  verification: {
    // Add Google Search Console & Bing verification tokens here when ready
    // google: 'your-google-token',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // dark class makes the dark palette the permanent default
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <GlobalUploadToast />
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
