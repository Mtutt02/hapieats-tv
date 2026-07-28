import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: wallet } = await supabase
    .from('flavor_wallets')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  // Purchase history (last 20)
  const { data: purchases } = await supabase
    .from('flavor_purchases')
    .select('id, package_id, points_credited, amount_usd, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    balance: wallet?.balance ?? 0,
    purchases: purchases ?? [],
  })
}
