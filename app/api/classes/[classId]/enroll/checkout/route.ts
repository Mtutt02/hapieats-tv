import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(
  req: NextRequest,
  { params }: { params: { classId: string } }
) {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (!key || key.length < 20) {
    return NextResponse.json(
      { error: 'Stripe is not configured on this server.' },
      { status: 503 }
    )
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: max 10 class checkout sessions per user per 10 minutes
  const rl = checkRateLimit(`${user.id}:class_checkout`, 10, 10 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests — please wait before checking out again.' }, { status: 429 })
  }

  // Fetch class details server-side — never trust client for price
  const { data: cls } = await supabase
    .from('classes')
    .select('id, title, price, is_published, max_students, enrollment_count, thumbnail_url')
    .eq('id', params.classId)
    .eq('is_published', true)
    .single()

  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  if (cls.price <= 0) return NextResponse.json({ error: 'Class is free — use the free enroll endpoint' }, { status: 400 })
  if (cls.max_students && cls.enrollment_count >= cls.max_students) {
    return NextResponse.json({ error: 'Class is full' }, { status: 409 })
  }

  // Check not already enrolled
  const { data: existing } = await supabase
    .from('class_enrollments')
    .select('id')
    .eq('class_id', params.classId)
    .eq('user_id', user.id)
    .single()

  if (existing) return NextResponse.json({ error: 'Already enrolled' }, { status: 409 })

  const body2 = await req.json()

  // Validate redirect URLs — must be same origin to prevent open redirect on payment flow
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')
  function safeRedirectUrl(url: string | undefined, fallback: string): string {
    if (!url) return fallback
    try {
      const parsed = new URL(url)
      const allowed = new URL(appOrigin)
      if (parsed.origin !== allowed.origin) return fallback
    } catch { return fallback }
    return url
  }
  const successUrl = safeRedirectUrl(body2.successUrl, `${appOrigin}/classes/${params.classId}?enrolled=1`)
  const cancelUrl = safeRedirectUrl(body2.cancelUrl, `${appOrigin}/classes/${params.classId}`)

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(cls.price), // DB stores price in cents; Stripe unit_amount is also cents
          product_data: {
            name: cls.title,
            description: 'HapiEats TV cooking class — lifetime access',
            ...(cls.thumbnail_url ? { images: [cls.thumbnail_url] } : {}),
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      checkoutMode: 'class_enrollment',
      classId: params.classId,
    },
  })

  return NextResponse.json({ url: session.url })
}
