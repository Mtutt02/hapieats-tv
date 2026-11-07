import { NextResponse } from 'next/server'
import { paymentsPaused, payoutsPaused, PAYMENTS_PAUSED_MESSAGE, PAYOUTS_PAUSED_MESSAGE } from '@/lib/payments-pause'

export const dynamic = 'force-dynamic'

// Public, read-only: lets the UI hide/disable buy, gift and withdraw buttons while the
// safety pause is on. The SERVER routes enforce the pause themselves; this is cosmetic.
export async function GET() {
  return NextResponse.json(
    {
      paymentsPaused: paymentsPaused(),
      payoutsPaused: payoutsPaused(),
      paymentsMessage: PAYMENTS_PAUSED_MESSAGE,
      payoutsMessage: PAYOUTS_PAUSED_MESSAGE,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
