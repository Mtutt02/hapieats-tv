import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/munchor/confirm?token=...&next=...
 *
 * Completes a Munchor <-> HapiEats link. Reached only by clicking the magic
 * link emailed in /api/auth/munchor/login case 3.
 *
 * Two independent facts must line up before the link is written:
 *
 *   1. Supabase's own `code` in the URL exchanges for a session — this proves
 *      the clicker controls the email address.
 *   2. Our single-use `token` resolves to a pending request for that exact
 *      HapiEats user — this proves the click belongs to the Munchor sign-in
 *      that started the flow, not some other magic link.
 *
 * Requiring both is what stops a stray magic link from silently attaching a
 * stranger's Munchor account, and stops a stolen token from being redeemed by
 * anyone who does not also control the mailbox.
 */
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

function fail(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/login?munchor_error=${encodeURIComponent(reason)}`)
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const rawToken = searchParams.get('token')
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard'

  if (!rawToken) return fail(origin, 'missing_token')
  if (!code) return fail(origin, 'missing_code')

  // ── 1. Prove control of the mailbox ──────────────────────────────────────
  const supabase = createClient()
  const { data: sessionData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeErr || !sessionData?.user) {
    console.error('[munchor/confirm] code exchange failed:', exchangeErr?.message)
    return fail(origin, 'link_expired')
  }
  const signedInUser = sessionData.user

  // ── 2. Resolve the pending request ───────────────────────────────────────
  const service = createServiceClient()
  const { data: request } = await service
    .from('munchor_link_requests')
    .select('token_hash, hapieats_user_id, munchor_user_id, munchor_email, expires_at, consumed_at')
    .eq('token_hash', sha256(rawToken))
    .maybeSingle()

  if (!request) return fail(origin, 'invalid_token')
  if (request.consumed_at) return fail(origin, 'already_used')
  if (new Date(request.expires_at) < new Date()) return fail(origin, 'link_expired')

  // The session established above must be the very account the request targets.
  if (request.hapieats_user_id !== signedInUser.id) {
    console.warn('[munchor/confirm] token/session mismatch', {
      expected: request.hapieats_user_id,
      got: signedInUser.id,
    })
    return fail(origin, 'account_mismatch')
  }

  // ── 3. Burn the token first ──────────────────────────────────────────────
  // Conditional on consumed_at still being null, so two concurrent clicks
  // cannot both proceed. The loser sees 'already_used'.
  const { data: claimed, error: claimErr } = await service
    .from('munchor_link_requests')
    .update({ consumed_at: new Date().toISOString() })
    .eq('token_hash', request.token_hash)
    .is('consumed_at', null)
    .select('token_hash')
    .maybeSingle()

  if (claimErr || !claimed) return fail(origin, 'already_used')

  // ── 4. Write the link ────────────────────────────────────────────────────
  const { error: linkErr } = await service.from('munchor_identities').insert({
    hapieats_user_id: request.hapieats_user_id,
    munchor_user_id: request.munchor_user_id,
    munchor_email: request.munchor_email,
    last_login_at: new Date().toISOString(),
  })

  if (linkErr) {
    // 23505 = already linked (a duplicate click, or linked by another route).
    // The user is signed in and the link exists either way, so treat as success.
    if ((linkErr as { code?: string }).code !== '23505') {
      console.error('[munchor/confirm] link insert failed:', linkErr)
      return fail(origin, 'link_failed')
    }
  }

  return NextResponse.redirect(`${origin}${next}?munchor=connected`)
}
