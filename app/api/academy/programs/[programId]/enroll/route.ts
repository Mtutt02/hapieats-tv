import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// POST — enroll the caller in a program. Free → insert row. Paid → Stripe checkout.
export async function POST(req: NextRequest, { params }: { params: { programId: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in to enroll' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { successUrl?: string; cancelUrl?: string }

    const { data: program, error } = await supabase
      .from('programs')
      .select('id, title, price, owner_id, is_published, institution_id')
      .eq('id', params.programId)
      .single()

    if (error || !program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    if (!program.is_published) return NextResponse.json({ error: 'Program is not open for enrollment' }, { status: 400 })
    if (program.owner_id === user.id) {
      return NextResponse.json({ error: 'You own this program' }, { status: 400 })
    }

    // Already enrolled?
    const { data: existing } = await supabase
      .from('program_enrollments')
      .select('id')
      .eq('program_id', program.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) return NextResponse.json({ enrolled: true, message: 'Already enrolled' })

    const price = Number(program.price ?? 0)

    // Free — enroll directly.
    if (!price || price <= 0) {
      const { error: enrollErr } = await supabase
        .from('program_enrollments')
        .insert({ program_id: program.id, user_id: user.id, status: 'active' })
      if (enrollErr) {
        console.error('[academy/programs/enroll] insert error:', enrollErr)
        return NextResponse.json({ error: 'Enrollment failed — please try again' }, { status: 500 })
      }
      return NextResponse.json({ enrolled: true })
    }

    // Paid — Stripe checkout (enrollment row is created by the webhook on completion).
    const key = process.env.STRIPE_SECRET_KEY ?? ''
    if (!key || key.length < 20 || key.includes('placeholder')) {
      return NextResponse.json({ error: 'Payments are not configured yet — contact support' }, { status: 503 })
    }

    const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')
    const isSafeUrl = (url: string | undefined) => {
      if (!url) return false
      try { return new URL(url).origin === new URL(appOrigin).origin } catch { return false }
    }
    const safeSuccess = isSafeUrl(body.successUrl) ? body.successUrl! : `${appOrigin}/academy`
    const safeCancel = isSafeUrl(body.cancelUrl) ? body.cancelUrl! : `${appOrigin}/academy`

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
      success_url: `${safeSuccess}?program_enrolled=1`,
      cancel_url: safeCancel,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(price * 100),
          product_data: {
            name: program.title,
            description: 'HapiEats Academy Program — full curriculum access',
          },
        },
        quantity: 1,
      }],
      metadata: {
        checkoutMode: 'program_enrollment',
        kind: 'program_enrollment',
        programId: program.id,
        userId: user.id,
        priceUsd: price.toString(),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[academy/programs/enroll] error:', err)
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 })
  }
}
