import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (!key || key === 'sk_test_' || key.length < 20 || key.includes('placeholder')) {
    return NextResponse.json({
      error: 'Stripe is not configured on this server. Add STRIPE_SECRET_KEY to your environment variables.',
      setup: true,
    }, { status: 503 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connect_id, email')
    .eq('id', user.id)
    .single()

  let connectId = profile?.stripe_connect_id

  // Create Connect Express account if none exists
  if (!connectId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email ?? profile?.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { supabase_user_id: user.id },
    })
    connectId = account.id

    await supabase
      .from('profiles')
      .update({ stripe_connect_id: connectId })
      .eq('id', user.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: connectId,
    refresh_url: `${appUrl}/dashboard/monetize?refresh=1`,
    return_url: `${appUrl}/dashboard/monetize?connected=1`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: accountLink.url })
}
