import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in to enroll' }, { status: 401 })

    const body = await req.json()
    const { courseId, successUrl, cancelUrl } = body

    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 })
    }

    // Fetch course (must be published)
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, title, pricing_model, price_usd, stripe_price_id, creator_id, enrollment_count')
      .eq('id', courseId)
      .eq('status', 'published')
      .single()

    if (courseErr || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Can't enroll in your own course
    if (course.creator_id === user.id) {
      return NextResponse.json({ error: 'You are the instructor for this course' }, { status: 400 })
    }

    // Check already enrolled
    const { data: existing } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ enrolled: true, message: 'Already enrolled' })
    }

    // Free course — enroll directly
    if (course.pricing_model === 'free') {
      const { error: enrollErr } = await supabase
        .from('course_enrollments')
        .insert({ course_id: courseId, user_id: user.id, amount_paid_usd: 0 })

      if (enrollErr) {
        console.error('[enroll] DB error:', enrollErr)
        return NextResponse.json({ error: 'Enrollment failed — please try again' }, { status: 500 })
      }

      // Increment enrollment count
      await supabase
        .from('courses')
        .update({ enrollment_count: (course.enrollment_count ?? 0) + 1 })
        .eq('id', courseId)

      return NextResponse.json({ enrolled: true })
    }

    // Paid course — create Stripe checkout
    const key = process.env.STRIPE_SECRET_KEY ?? ''
    if (!key || key.length < 20 || key.includes('placeholder')) {
      return NextResponse.json({
        error: 'Payments are not configured yet — contact support',
      }, { status: 503 })
    }

    // Validate redirect URLs (same origin only)
    const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')
    const isSafeUrl = (url: string | undefined) => {
      if (!url) return false
      try { return new URL(url).origin === new URL(appOrigin).origin } catch { return false }
    }

    const safeSuccess = isSafeUrl(successUrl) ? successUrl : `${appOrigin}/learn/${courseId}`
    const safeCancel = isSafeUrl(cancelUrl) ? cancelUrl : `${appOrigin}/courses/${courseId}`

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
      success_url: `${safeSuccess}?enrolled=1`,
      cancel_url: safeCancel,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round((course.price_usd ?? 0) * 100),
          product_data: {
            name: course.title,
            description: 'HapiEats TV Course — Lifetime access',
          },
        },
        quantity: 1,
      }],
      metadata: {
        checkoutMode: 'course_enrollment',
        courseId,
        userId: user.id,
        priceUsd: (course.price_usd ?? 0).toString(),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[courses/enroll] Error:', err)
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 })
  }
}
