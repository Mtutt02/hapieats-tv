import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'
import ClipsFeed from '@/components/clips/ClipsFeed'

export const metadata: Metadata = {
  title: 'Clips — HapiEats TV',
  description: 'Bite-sized food videos — swipe through the tastiest clips on HapiEats TV.',
}

export default function ClipsPage() {
  return (
    <AppShell fullWidth>
      <ClipsFeed />
    </AppShell>
  )
}
