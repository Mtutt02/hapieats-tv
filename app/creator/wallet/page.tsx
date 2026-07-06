import { createClient, createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import CreatorWalletClient from '@/components/tokens/CreatorWalletClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Creator Wallet — HapiEats TV' }

export default async function CreatorWalletPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/creator/wallet')

  const { data: profile } = await supabase.from('profiles').select('is_creator, display_name').eq('id', user.id).single()
  if (!profile?.is_creator) redirect('/dashboard')

  const service = createServiceClient()

  await service.rpc('ensure_creator_wallet', { p_creator_id: user.id })

  const [
    { data: wallet },
    { data: streak },
    { data: recentGifts },
    { data: activeGoals },
    { data: tokens },
    { data: monetizationRequest },
  ] = await Promise.all([
    service.from('creator_wallets').select('*').eq('creator_id', user.id).single(),
    service.from('creator_streaks').select('*').eq('creator_id', user.id).single(),
    service.from('live_gift_transactions')
      .select('id, total_tokens, creator_earned_cents, created_at, gift:live_gifts(name, emoji), sender:profiles!live_gift_transactions_sender_id_fkey(username, display_name)')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    service.from('creator_goals')
      .select('id, title, target_tokens, current_tokens, status, deadline')
      .eq('creator_id', user.id)
      .eq('status', 'active')
      .limit(5),
    service.from('hapi_tokens').select('lifetime_purchased, balance').eq('user_id', user.id).maybeSingle(),
    service.from('monetization_requests')
      .select('id, status, admin_note, created_at, reviewed_at')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const monetizationStatus = (wallet as any)?.monetization_status ?? 'locked'
  const lifetimePurchased = tokens?.lifetime_purchased ?? 0

  return (
    <AppShell>
      <CreatorWalletClient
        wallet={wallet ?? { creator_id: user.id, tokens_received: 0, pending_cents: 0, redeemable_cents: 0, lifetime_earnings_cents: 0, monthly_earnings: {}, payout_status: 'none', last_payout_at: null, last_payout_cents: 0 }}
        streak={streak ?? null}
        recentGifts={(recentGifts ?? []) as any[]}
        activeGoals={(activeGoals ?? []) as any[]}
        displayName={profile.display_name ?? 'Creator'}
        monetizationStatus={monetizationStatus}
        lifetimePurchased={lifetimePurchased}
        autoUnlockThreshold={500}
        pendingRequest={(monetizationRequest ?? null) as any}
      />
    </AppShell>
  )
}
