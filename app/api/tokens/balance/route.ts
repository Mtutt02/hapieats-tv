import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/tokens/balance — the caller's Hapi Token balance.
 *
 * Reads `hapi_tokens`, which is the live balance table: every debit goes
 * through the record_token_movement RPC against it, and both the Stripe and
 * RevenueCat purchase paths credit it.
 *
 * It previously read `token_balances`, the pre-July legacy table. Only the
 * Stripe webhook still mirrors writes there, so that balance never fell when
 * tokens were spent and never rose for an in-app purchase — it reported a
 * number that drifted further from the truth with every transaction.
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // hapi_tokens is service-role managed; read it with the service client so a
  // missing row reads as 0 rather than failing under RLS.
  const { data, error } = await createServiceClient()
    .from('hapi_tokens')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[tokens/balance] read failed:', error)
    return NextResponse.json({ error: 'Could not read balance' }, { status: 500 })
  }

  return NextResponse.json({ balance: data?.balance ?? 0 })
}
