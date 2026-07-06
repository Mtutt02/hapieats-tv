import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminShell from '@/components/admin/AdminShell'
import MonetizationReviewClient from '@/components/admin/MonetizationReviewClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Monetization Requests — Admin' }

export default async function AdminMonetizationPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const service = createServiceClient()

  const { data: requests } = await service
    .from('monetization_requests')
    .select(`
      id, status, request_note, admin_note, created_at, reviewed_at,
      creator:profiles!monetization_requests_creator_id_fkey(
        id, username, display_name, avatar_url, created_at
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  // Also pull wallet + token data for each creator
  const creatorIds = (requests ?? []).map((r: any) => r.creator?.id).filter(Boolean)

  const [{ data: wallets }, { data: tokenBalances }] = await Promise.all([
    creatorIds.length
      ? service.from('creator_wallets')
          .select('creator_id, monetization_status, tokens_received, lifetime_earnings_cents')
          .in('creator_id', creatorIds)
      : Promise.resolve({ data: [] }),
    creatorIds.length
      ? service.from('hapi_tokens')
          .select('user_id, lifetime_purchased, balance')
          .in('user_id', creatorIds)
      : Promise.resolve({ data: [] }),
  ])

  const walletMap = Object.fromEntries((wallets ?? []).map((w: any) => [w.creator_id, w]))
  const tokenMap = Object.fromEntries((tokenBalances ?? []).map((t: any) => [t.user_id, t]))

  const enriched = (requests ?? []).map((r: any) => ({
    ...r,
    wallet: walletMap[r.creator?.id] ?? null,
    tokens: tokenMap[r.creator?.id] ?? null,
  }))

  const pending = enriched.filter((r: any) => r.status === 'pending')
  const reviewed = enriched.filter((r: any) => r.status !== 'pending')

  return (
    <AdminShell>
      <MonetizationReviewClient pending={pending} reviewed={reviewed} />
    </AdminShell>
  )
}
