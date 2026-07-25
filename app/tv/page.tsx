import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'
import TVBrowser, { TVChannel, TVPlaylistItem } from '@/components/tv/TVBrowser'

export const dynamic = 'force-dynamic'

// Cache-bust: cfg 2026-07-25 20:45

export const metadata: Metadata = {
  title: 'HapiEats TV',
  description: 'Flip through food channels — live streams, on-demand recipes, and more.',
}

const FALLBACK_CHANNELS: TVChannel[] = [
  { number: 1, name: 'The Main Stage', icon: '🍽️', description: 'The heart of HapiEats TV', category: 'General', currentTitle: 'Off Air' },
  { number: 2, name: 'Street Eats', icon: '🌮', description: 'Street food worldwide', category: 'Street Food', currentTitle: 'Off Air' },
  { number: 3, name: 'Fire and Smoke', icon: '🔥', description: 'BBQ and live fire', category: 'BBQ', currentTitle: 'Off Air' },
  { number: 4, name: 'Rise and Bake', icon: '🥐', description: 'Baking and pastry', category: 'Baking', currentTitle: 'Off Air' },
  { number: 5, name: 'Sweet Spot', icon: '🍫', description: 'Desserts', category: 'Desserts', currentTitle: 'Off Air' },
  { number: 6, name: 'Family Table', icon: '🍝', description: 'Italian classics', category: 'Italian', currentTitle: 'Off Air' },
  { number: 7, name: 'Wander and Taste', icon: '🍣', description: 'Japanese kitchen', category: 'Japanese', currentTitle: 'Off Air' },
  { number: 8, name: 'Fresh and Fit', icon: '🌱', description: 'Plant-based', category: 'Plant-Based', currentTitle: 'Off Air' },
  { number: 9, name: 'Wanderlust', icon: '✈️', description: 'Food travel', category: 'Travel', currentTitle: 'Off Air' },
  { number: 10, name: 'The Good Life', icon: '✨', description: 'Lifestyle', category: 'Lifestyle', currentTitle: 'Off Air' },
]

export default async function TVPage() {
  return (
    <AppShell fullWidth>
      <TVBrowser channels={FALLBACK_CHANNELS} />
    </AppShell>
  )
}
