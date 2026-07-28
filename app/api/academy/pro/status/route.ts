/**
 * GET /api/academy/pro/status
 *
 * Returns the caller's HapiEats Pro membership state.
 *   - Auth required.
 *   - isPro reflects the is_pro_member RPC (active/trialing + unexpired period).
 *   - current_period_end / status come from the pro_subscriptions row when present.
 */

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isProMember } from '@/lib/academy/pro'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const [isPro, subRes] = await Promise.all([
    isProMember(service, user.id),
    service
      .from('pro_subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .single(),
  ])

  return NextResponse.json({
    isPro,
    status: subRes.data?.status ?? null,
    current_period_end: subRes.data?.current_period_end ?? null,
  })
}
