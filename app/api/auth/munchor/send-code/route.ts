import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { isMunchorConfigured, sendMunchorCode, toE164, type MunchorCodeTarget } from '@/lib/munchor'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/munchor/send-code
 * Body: { email } or { phone }
 *
 * Asks Munchor to email or text the 6-digit code its own app uses for code and
 * phone sign-in. The code is then checked by /api/auth/munchor/login with
 * method "code". Sign-in only: no Munchor account is ever created here, and an
 * address or number Munchor does not know gets the same response as one it
 * does, so this cannot be used to find out who is on Munchor.
 */
export async function POST(req: NextRequest) {
  if (!(await isMunchorConfigured())) {
    return NextResponse.json({ error: 'Munchor sign-in is not configured yet.' }, { status: 503 })
  }

  let body: { email?: string; phone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  let target: MunchorCodeTarget
  let bucket: string
  if (typeof body.phone === 'string' && body.phone.trim()) {
    const phone = toE164(body.phone)
    if (!phone) {
      return NextResponse.json(
        { error: 'Enter a full phone number, including the area code.' },
        { status: 400 },
      )
    }
    target = { phone }
    bucket = `phone:${phone}`
  } else {
    const email = (body.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter your Munchor email address.' }, { status: 400 })
    }
    target = { email }
    bucket = `email:${email}`
  }

  // Each send is a real email or text message, so throttle per destination
  // (protects the recipient) and per IP (protects Munchor's sending quota).
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  for (const [key, limit] of [
    [`munchor_code:${bucket}`, 3],
    [`munchor_code:ip:${ip}`, 10],
  ] as const) {
    if (!checkRateLimit(key, limit, 10 * 60_000).allowed) {
      return NextResponse.json(
        { error: 'Too many codes requested — please wait a few minutes.' },
        { status: 429 },
      )
    }
  }

  const sent = await sendMunchorCode(target)
  if (!sent.ok) {
    if (sent.reason === 'rate_limited') {
      return NextResponse.json(
        { error: 'Munchor is limiting how often codes can be sent — try again in a minute.' },
        { status: 429 },
      )
    }
    if (sent.reason === 'not_configured') {
      return NextResponse.json({ error: 'Munchor sign-in is not configured yet.' }, { status: 503 })
    }
    return NextResponse.json(
      { error: 'Munchor could not send a code right now — please try again.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ status: 'sent', channel: 'phone' in target ? 'phone' : 'email' })
}
