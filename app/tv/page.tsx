import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'
import TVBrowser, { TVChannel } from '@/components/tv/TVBrowser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'HapiEats TV',
  description: 'Flip through food channels — live streams, on-demand recipes, and more.',
}

const CHANNELS: TVChannel[] = [
  { number: 1, name: 'The Main Stage', icon: '🍽️', description: 'The heart of HapiEats TV', category: 'General', currentTitle: 'Off Air' },
  { number: 2, name: 'Street Eats', icon: '🌮', description: 'Street food worldwide', category: 'Street Food', currentTitle: 'Off Air' },
]

export default async function TVPage() {
  return (
    <AppShell fullWidth>
      <TVBrowser channels={CHANNELS} />
    </AppShell>
  )
}
