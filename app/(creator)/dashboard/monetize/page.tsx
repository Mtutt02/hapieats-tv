import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import CreatorMonetizationClient from '@/components/creator/CreatorMonetizationClient'
import CreatorFlavorEarnings from '@/components/flavor/CreatorFlavorEarnings'

export const metadata: Metadata = {
  title: 'Monetization',
  description: 'Manage your HapiEats TV earnings, Stripe payouts, and Flavor Points cashouts.',
}

export default async function MonetizePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/dashboard/monetize')

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connect_id')
    .eq('id', user.id)
    .single()

  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, slug, subscription_price, stripe_price_id')
    .eq('creator_id', user.id)

  // Earnings
  const { data: purchases } = await supabase
    .from('purchases')
    .select('amount, created_at, video:videos!inner(creator_id)')
    .eq('video.creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('amount, created_at, channel:channels!inner(creator_id)')
    .eq('channel.creator_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50)

  const totalPPV = (purchases ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
  const totalSubs = (subscriptions ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)

  // Platform takes 20%, creator gets 80%
  const PLATFORM_CUT = 0.20
  const creatorShare = (totalPPV + totalSubs) * (1 - PLATFORM_CUT)

  return (
    <AppShell>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Monetization</h1>
        <p className="text-muted-foreground mb-8">
          Set your subscription prices and connect Stripe to receive payments.
          HapiEats TV takes a <strong>20%</strong> platform fee — you keep <strong>80%</strong>.
        </p>

        <CreatorMonetizationClient
          hasConnectId={!!profile?.stripe_connect_id}
          channels={channels ?? []}
          earnings={{
            ppv: totalPPV,
            subscriptions: totalSubs,
            creatorShare,
          }}
        />

        {/* Flavor Points earnings & cashout */}
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-1">Flavor Points Earnings</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Earnings from live stream gifts. You receive <strong>50%</strong> of every gift&apos;s point value.
            Cash out anytime with a <strong>5% platform fee</strong>.
          </p>
          <CreatorFlavorEarnings />
        </div>
      </main>
    </AppShell>
  )
}
