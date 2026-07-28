import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import GoLiveStudio from '@/components/creator/GoLiveStudio'
import CreatorProUpgradeWall from '@/components/creator/CreatorProUpgradeWall'

export const metadata: Metadata = {
  title: 'Go Live',
  description: 'Start a live cooking stream on HapiEats TV.',
}

export default async function GoLivePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/studio/go-live')

  // Check Creator Pro subscription (admins bypass this gate)
  const { data: profile } = await supabase
    .from('profiles')
    .select('platform_subscription_status, role')
    .eq('id', user.id)
    .single()

  const isPro = profile?.platform_subscription_status === 'active'
  const isAdmin = ['admin', 'superadmin'].includes(profile?.role ?? '')

  // Non-pro, non-admin users see the upgrade wall
  if (!isPro && !isAdmin) {
    return (
      <AppShell>
        <main className="max-w-3xl mx-auto px-4 py-8">
          <CreatorProUpgradeWall />
        </main>
      </AppShell>
    )
  }

  // Pro users: must have a channel
  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, slug')
    .eq('creator_id', user.id)

  if (!channels || channels.length === 0) {
    redirect('/studio/channel/new')
  }

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <GoLiveStudio channels={channels} />
      </main>
    </AppShell>
  )
}
