import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Ensure wallet exists
  await service.rpc('ensure_token_wallet', { p_user_id: user.id })

  const [
    { data: wallet },
    { data: creatorWallet },
    { data: ledger },
  ] = await Promise.all([
    service.from('hapi_tokens').select('*').eq('user_id', user.id).single(),
    service.from('creator_wallets').select('*').eq('creator_id', user.id).single(),
    service.from('token_ledger')
      .select('id, type, amount, balance_after, description, created_at, related_user_id, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({
    wallet: wallet ?? { user_id: user.id, balance: 0, lifetime_purchased: 0, lifetime_spent: 0, lifetime_gifted: 0 },
    creator_wallet: creatorWallet ?? null,
    recent_ledger: ledger ?? [],
  })
}
