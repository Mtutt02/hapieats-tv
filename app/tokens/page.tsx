import { createClient, createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import TokenStoreClient from '@/components/tokens/TokenStoreClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Hapi Tokens — HapiEats TV' }

export default async function TokensPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/tokens')

  const service = createServiceClient()

  // Ensure wallet exists
  await service.rpc('ensure_token_wallet', { p_user_id: user.id })

  const [
    { data: packs },
    { data: wallet },
    { data: gifts },
  ] = await Promise.all([
    service.from('token_packs').select('*').eq('is_active', true).order('sort_order'),
    service.from('hapi_tokens').select('*').eq('user_id', user.id).single(),
    service.from('live_gifts').select('*').eq('is_active', true).order('display_priority'),
  ])

  return (
    <AppShell>
      <TokenStoreClient
        packs={packs ?? []}
        wallet={wallet ?? { user_id: user.id, balance: 0, lifetime_purchased: 0, lifetime_spent: 0, lifetime_gifted: 0 }}
        gifts={gifts ?? []}
      />
    </AppShell>
  )
}
