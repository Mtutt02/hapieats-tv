import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (!key || key.length < 20 || key.includes('placeholder')) {
    return NextResponse.json({ error: 'Payments are not configured on this server.', setup: true }, { status: 503 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connect_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_connect_id) {
    return NextResponse.json({ error: 'No Stripe account connected' }, { status: 400 })
  }

  const loginLink = await stripe.accounts.createLoginLink(profile.stripe_connect_id)

  return NextResponse.json({ url: loginLink.url })
}
