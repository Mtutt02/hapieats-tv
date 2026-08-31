import { NextResponse } from 'next/server'
import { isMunchorConfigured } from '@/lib/munchor'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/munchor/status
 *
 * Whether "Continue with Munchor" should be offered. Lets the (client-side)
 * login page discover this without a second NEXT_PUBLIC_ flag that could drift
 * out of sync with the real credentials.
 *
 * Deliberately returns nothing but a boolean — no URLs, no key material.
 */
export async function GET() {
  return NextResponse.json({ enabled: isMunchorConfigured() })
}
