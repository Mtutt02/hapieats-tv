import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (!key || key.length < 20 || key.includes('placeholder')) {
    return NextResponse.json({ error: 'Payments are not configured on this server.', setup: true }, { status: 503 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channelId, priceUsd } = await req.json()
  if (!channelId || !priceUsd || priceUsd < 0.99) {
    return NextResponse.json({ error: 'channelId and priceUsd (≥ $0.99) required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify channel belongs to this creator
  const { data: channel } = await service
    .from('channels')
    .select('id, name, stripe_product_id, stripe_price_id')
    .eq('id', channelId)
    .eq('creator_id', user.id)
    .single()

  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  const priceInCents = Math.round(priceUsd * 100)

  // Create Stripe product if needed
  let productId = channel.stripe_product_id
  if (!productId) {
    const product = await stripe.products.create({
      name: channel.name,
      metadata: { channel_id: channelId },
    })
    productId = product.id
    await service.from('channels').update({ stripe_product_id: productId }).eq('id', channelId)
  }

  // Archive old price if exists
  if (channel.stripe_price_id) {
    await stripe.prices.update(channel.stripe_price_id, { active: false }).catch(() => {})
  }

  // Create new price
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: priceInCents,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { channel_id: channelId },
  })

  // Update channel
  await service
    .from('channels')
    .update({ subscription_price: priceUsd, stripe_price_id: price.id })
    .eq('id', channelId)

  return NextResponse.json({ success: true, priceId: price.id })
}
