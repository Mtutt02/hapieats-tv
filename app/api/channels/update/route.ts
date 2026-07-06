import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createChannelSubscriptionPrice } from '@/lib/stripe'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    name?: string
    description?: string | null
    subscription_price?: number | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Fetch the creator's channel
  const { data: existingChannel, error: fetchError } = await supabase
    .from('channels')
    .select('*')
    .eq('creator_id', user.id)
    .single()

  if (fetchError || !existingChannel) {
    return NextResponse.json({ error: 'Channel not found.' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: 'Channel name must be between 2 and 80 characters.' },
        { status: 400 }
      )
    }
    updates.name = name
  }

  if (body.description !== undefined) {
    updates.description = body.description || null
  }

  // Handle subscription price changes
  if (body.subscription_price !== undefined) {
    const newPrice = body.subscription_price

    if (newPrice === null) {
      // Removing the subscription price (free channel)
      updates.subscription_price = null
      updates.stripe_price_id = null
    } else {
      if (newPrice < 0.99) {
        return NextResponse.json(
          { error: 'Subscription price must be at least $0.99.' },
          { status: 400 }
        )
      }

      const priceChanged = existingChannel.subscription_price !== newPrice

      if (priceChanged) {
        try {
          const channelName = (body.name ?? existingChannel.name) as string
          const amountInCents = Math.round(newPrice * 100)
          const { priceId } = await createChannelSubscriptionPrice(channelName, amountInCents)
          updates.subscription_price = newPrice
          updates.stripe_price_id = priceId
        } catch (stripeErr) {
          const message =
            stripeErr instanceof Error ? stripeErr.message : 'Stripe error'
          return NextResponse.json(
            { error: `Failed to create Stripe price: ${message}` },
            { status: 500 }
          )
        }
      } else {
        updates.subscription_price = newPrice
      }
    }
  }

  const { data: channel, error: updateError } = await supabase
    .from('channels')
    .update(updates)
    .eq('creator_id', user.id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ channel })
}
