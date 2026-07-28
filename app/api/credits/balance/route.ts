import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()

  // Balance
  const { data: credits } = await serviceClient
    .from('app_credits')
    .select('gift_balance, loan_balance, loan_repaid, updated_at')
    .eq('user_id', user.id)
    .single()

  // Ledger history (last 50)
  const { data: ledger } = await serviceClient
    .from('credit_ledger')
    .select('id, entry_type, amount, gift_balance_after, loan_balance_after, reference_id, reference_type, notes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    giftBalance: parseFloat(credits?.gift_balance ?? '0'),
    loanBalance: parseFloat(credits?.loan_balance ?? '0'),
    loanRepaid: parseFloat(credits?.loan_repaid ?? '0'),
    totalAvailable: parseFloat(credits?.gift_balance ?? '0') + parseFloat(credits?.loan_balance ?? '0'),
    updatedAt: credits?.updated_at ?? null,
    ledger: ledger ?? [],
  })
}
