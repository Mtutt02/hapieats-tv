import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connect_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_connect_id) {
    return NextResponse.json({ connected: false, chargesEnabled: false, payoutsEnabled: false })
  }

  const account = await stripe.accounts.retrieve(profile.stripe_connect_id)

  return NextResponse.json({
    connected: true,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    requiresInfo: !account.details_submitted,
    accountId: account.id,
  })
}
