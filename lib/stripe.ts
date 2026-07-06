import Stripe from 'stripe'

// Use a placeholder so the module loads even when the key isn't configured.
// Routes that need Stripe should guard with: if (!process.env.STRIPE_SECRET_KEY) return 503
const _stripeKey = process.env.STRIPE_SECRET_KEY ?? 'sk_placeholder_not_configured_add_key_to_vercel'
export const stripe = new Stripe(_stripeKey, {
  apiVersion: '2024-06-20',
  typescript: true,
})

export type CheckoutMode = 'creator_subscription' | 'pay_per_view' | 'platform_subscription'

interface CreateCheckoutOptions {
  mode: CheckoutMode
  userId: string
  userEmail: string
  successUrl: string
  cancelUrl: string
  // For creator_subscription
  channelId?: string
  channelName?: string
  stripePriceId?: string
  // For pay_per_view
  videoId?: string
  videoTitle?: string
  priceInCents?: number
  // For platform_subscription — uses env var price
}

export async function createCheckoutSession(opts: CreateCheckoutOptions) {
  const baseParams: Stripe.Checkout.SessionCreateParams = {
    customer_email: userEmailNotUsedDirectly(opts),
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: {
      userId: opts.userId,
      mode: opts.mode,
      channelId: opts.channelId ?? '',
      videoId: opts.videoId ?? '',
    },
  }

  if (opts.mode === 'creator_subscription') {
    return stripe.checkout.sessions.create({
      ...baseParams,
      mode: 'subscription',
      line_items: [{ price: opts.stripePriceId!, quantity: 1 }],
      subscription_data: {
        metadata: {
          userId: opts.userId,
          channelId: opts.channelId!,
        },
      },
    })
  }

  if (opts.mode === 'pay_per_view') {
    return stripe.checkout.sessions.create({
      ...baseParams,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: opts.priceInCents!,
            product_data: { name: opts.videoTitle! },
          },
          quantity: 1,
        },
      ],
    })
  }

  // platform_subscription
  return stripe.checkout.sessions.create({
    ...baseParams,
    mode: 'subscription',
    line_items: [
      { price: process.env.NEXT_PUBLIC_STRIPE_PLATFORM_PRICE_ID!, quantity: 1 },
    ],
  })
}

// Helper to avoid TS unused-variable errors
function userEmailNotUsedDirectly(opts: CreateCheckoutOptions) {
  return opts.userEmail
}

/** Create a price for a creator channel subscription */
export async function createChannelSubscriptionPrice(channelName: string, amountInCents: number) {
  const product = await stripe.products.create({ name: `${channelName} — Channel Subscription` })
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountInCents,
    currency: 'usd',
    recurring: { interval: 'month' },
  })
  return { productId: product.id, priceId: price.id }
}

/** Create a one-time price for a pay-per-view video */
export async function createVideoPurchasePrice(videoTitle: string, amountInCents: number) {
  const product = await stripe.products.create({ name: videoTitle })
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountInCents,
    currency: 'usd',
  })
  return { productId: product.id, priceId: price.id }
}
