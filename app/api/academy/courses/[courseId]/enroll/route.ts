/**
 * POST /api/academy/courses/[courseId]/enroll
 *
 * Determines access + enrolls the caller in an Academy course.
 *
 *   pricing_model = 'free'                         → enroll directly (source 'free')
 *   pricing_model = 'pro_only' OR pro_included,
 *     and caller is_pro_member                     → enroll (source 'pro')
 *   pricing_model = 'paid', body.method = 'tokens' → debit tokens (100 tokens = $1)
 *   pricing_model = 'paid', body.method = 'stripe' → Stripe checkout, return { checkoutUrl }
 *
 * Enrollment insert is idempotent (duplicate ignored). On any successful
 * free/token/pro enroll we bump the course enrollment count.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { courseId: string } }) {
  try {
    const courseId = params.courseId
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in to enroll' }, { status: 401 })

    let body: { method?: 'tokens' | 'stripe'; successUrl?: string; cancelUrl?: string } = {}
    try { body = await req.json() } catch { /* no body — fine for free/pro */ }

    const service = createServiceClient()

    // Fetch course (must be published)
    const { data: course, error: courseErr } = await service
      .from('courses')
      .select('id, title, creator_id, pricing_model, price, pro_included, stripe_price_id, enrollment_count, status')
      .eq('id', courseId)
      .single()

    if (courseErr || !course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (course.status && course.status !== 'published') {
      return NextResponse.json({ error: 'Course is not available' }, { status: 404 })
    }
    if (course.creator_id === user.id) {
      return NextResponse.json({ error: 'You are the instructor for this course' }, { status: 400 })
    }

    // Already enrolled? — idempotent success
    const { data: existing } = await service
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) return NextResponse.json({ enrolled: true })

    // ── Finalize a free/token/pro enrollment (idempotent insert + count bump) ──
    async function finalize(source: string, amountPaidUsd: number) {
      const { error: insErr } = await service
        .from('course_enrollments')
        .insert({ course_id: courseId, user_id: user!.id, source, amount_paid_usd: amountPaidUsd })
      // Ignore duplicate-key races (unique course_id,user_id)
      if (insErr && (insErr as { code?: string }).code !== '23505') {
        // `source`/`amount_paid_usd` columns may not exist — retry minimal insert
        const { error: retryErr } = await service
          .from('course_enrollments')
          .insert({ course_id: courseId, user_id: user!.id })
        if (retryErr && (retryErr as { code?: string }).code !== '23505') {
          console.error('[academy/enroll] insert error:', insErr, retryErr)
          return NextResponse.json({ error: 'Enrollment failed — please try again' }, { status: 500 })
        }
      }
      await service.rpc('bump_course_enrollment', { p_course_id: courseId })
      return NextResponse.json({ enrolled: true })
    }

    // ── Free ────────────────────────────────────────────────────────────────
    if (course.pricing_model === 'free') {
      return finalize('free', 0)
    }

    // ── Pro access (pro_only course, or paid course flagged pro_included) ─────
    const proEligible = course.pricing_model === 'pro_only' || course.pro_included === true
    if (proEligible) {
      const { data: isPro } = await service.rpc('is_pro_member', { p_user_id: user.id })
      if (isPro === true) return finalize('pro', 0)
      // pro_only but not a Pro member → must subscribe first
      if (course.pricing_model === 'pro_only') {
        return NextResponse.json({ error: 'Pro membership required', requiresPro: true }, { status: 402 })
      }
      // otherwise (paid + pro_included, non-Pro) fall through to paid flow
    }

    // ── Paid ──────────────────────────────────────────────────────────────────
    if (course.pricing_model === 'paid') {
      const priceUsd = Number(course.price ?? 0)
      if (!priceUsd || priceUsd <= 0) {
        // Zero-priced "paid" course — just enroll
        return finalize('free', 0)
      }

      const method = body.method
      if (method !== 'tokens' && method !== 'stripe') {
        return NextResponse.json({ error: "method must be 'tokens' or 'stripe'" }, { status: 400 })
      }

      // ── Token-priced enrollment: 100 tokens = $1 ──
      if (method === 'tokens') {
        const tokenCost = Math.round(priceUsd * 100)

        // Balance check (defense-in-depth; RPC also guards with SELECT FOR UPDATE)
        const { data: wallet } = await service
          .from('hapi_tokens')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!wallet || wallet.balance < tokenCost) {
          return NextResponse.json(
            { error: 'Insufficient tokens', balance: wallet?.balance ?? 0, required: tokenCost },
            { status: 402 },
          )
        }

        const { error: debitErr } = await service.rpc('record_token_movement', {
          p_user_id: user.id,
          p_type: 'course_enrollment',
          p_amount: -tokenCost,
          p_related_user: course.creator_id,
          p_related_stream: null,
          p_description: `Enrolled in course: ${course.title}`,
          p_metadata: { course_id: courseId, price_usd: priceUsd, token_cost: tokenCost },
        })
        if (debitErr) {
          console.error('[academy/enroll] token debit error:', debitErr)
          return NextResponse.json({ error: 'Failed to deduct tokens' }, { status: 500 })
        }

        return finalize('tokens', priceUsd)
      }

      // ── Stripe checkout ──
      const key = process.env.STRIPE_SECRET_KEY ?? ''
      if (!key || key.length < 20 || key.includes('placeholder')) {
        return NextResponse.json({ error: 'Payments are not configured yet — contact support' }, { status: 503 })
      }

      const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')
      const isSafeUrl = (url: string | undefined) => {
        if (!url) return false
        try { return new URL(url).origin === new URL(appOrigin).origin } catch { return false }
      }
      const safeSuccess = isSafeUrl(body.successUrl) ? body.successUrl! : `${appOrigin}/learn/${courseId}?enrolled=1`
      const safeCancel = isSafeUrl(body.cancelUrl) ? body.cancelUrl! : `${appOrigin}/courses/${courseId}`

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
        success_url: safeSuccess,
        cancel_url: safeCancel,
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(priceUsd * 100),
            product_data: {
              name: course.title,
              description: 'HapiEats Academy — Lifetime access',
              metadata: { courseId },
            },
          },
          quantity: 1,
        }],
        metadata: {
          checkoutMode: 'course_enrollment',
          courseId,
          userId: user.id,
          priceUsd: priceUsd.toString(),
        },
      })

      return NextResponse.json({ checkoutUrl: session.url })
    }

    return NextResponse.json({ error: 'Unsupported pricing model' }, { status: 400 })
  } catch (err) {
    console.error('[academy/enroll]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
