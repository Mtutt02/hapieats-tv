import { NextResponse } from 'next/server'
import { isMunchorConfigured, munchorConfigProblems } from '@/lib/munchor'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/munchor/status
 *
 * Whether "Continue with Munchor" should be offered. Lets the (client-side)
 * login page discover this without a second NEXT_PUBLIC_ flag that could drift
 * out of sync with the real credentials.
 *
 * When disabled it also reports WHICH check failed. Without that, a missing
 * variable and a malformed one are indistinguishable from the outside, and the
 * only symptom is a button that never appears. The reasons name environment
 * variables and describe the failure — they never echo a value, so no key
 * material is exposed.
 */
export async function GET() {
  if (isMunchorConfigured()) {
    return NextResponse.json({ enabled: true })
  }

  return NextResponse.json({
    enabled: false,
    problems: munchorConfigProblems(),
    hint:
      'Vercel only applies environment variables to deployments created after ' +
      'they are saved. If these were added after the last deploy, redeploy to pick them up.',
  })
}
