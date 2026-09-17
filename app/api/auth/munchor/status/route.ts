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
  if (await isMunchorConfigured()) {
    return NextResponse.json({ enabled: true })
  }

  return NextResponse.json({
    enabled: false,
    problems: await munchorConfigProblems(),
    hint:
      'Set these either as Vercel environment variables (which need a redeploy to ' +
      'take effect) or as the munchor_sso row in platform_settings, which is read ' +
      'per request and applies immediately.',
  })
}
