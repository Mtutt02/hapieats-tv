import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  authenticateWithMunchor,
  isMunchorConfigured,
  usernameFromMunchor,
  type MunchorUser,
} from '@/lib/munchor'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/munchor/login
 * Body: { email, password, next? }
 *
 * Signs a Munchor user into HapiEats TV. Munchor lives on a separate Supabase
 * project, so the credentials are verified against Munchor's auth server and
 * the resulting identity is mapped onto a HapiEats account.
 *
 * Four outcomes:
 *
 *   1. Already linked        → sign straight in.
 *   2. No HapiEats account   → create one, link it, sign in. Nothing exists to
 *                              take over, so no confirmation is needed.
 *   3. HapiEats account with
 *      the same email        → DO NOT merge. Park a single-use link request and
 *                              email a magic link to that address. Clicking it
 *                              proves ownership and completes the link.
 *   4. Munchor email not
 *      confirmed by Munchor  → treated as case 3 even when no account exists,
 *                              because an unverified address is not evidence.
 *
 * Case 3 is the whole point: without it, anyone who could register a Munchor
 * account under someone else's address could walk into that person's HapiEats
 * account, tokens and all.
 */

const LINK_TOKEN_TTL_MINUTES = 30

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

/**
 * Find a free profiles.username.
 *
 * profiles.username is UNIQUE and the handle_new_user trigger inserts it as
 * part of the auth.users INSERT — so a collision does not merely skip the
 * profile, it aborts account creation outright. Resolve a free name before
 * calling createUser, and pass it through user_metadata, which the trigger
 * prefers over its split_part(email) fallback.
 */
async function pickAvailableUsername(
  service: ReturnType<typeof createServiceClient>,
  base: string,
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? base : `${base}${i + 1}`.slice(0, 30)
    const { data } = await service
      .from('profiles')
      .select('id')
      .eq('username', candidate)
      .maybeSingle()
    if (!data) return candidate
  }
  // Give up guessing and use something collision-resistant.
  return `munchor_${randomBytes(4).toString('hex')}`
}

/** Establish a HapiEats cookie session for a user we have already verified. */
async function signInAs(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = createServiceClient()

  const { data: link, error: linkErr } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !link?.properties?.hashed_token) {
    console.error('[munchor/login] generateLink failed:', linkErr?.message)
    return { ok: false, error: 'Could not start a HapiEats session' }
  }

  // Redeeming the token on the cookie-bound client writes the session cookies.
  const supabase = createClient()
  const { error: otpErr } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  })
  if (otpErr) {
    console.error('[munchor/login] verifyOtp failed:', otpErr.message)
    return { ok: false, error: 'Could not start a HapiEats session' }
  }

  return { ok: true }
}

/** Park a pending link and email the owner of the address a confirmation link. */
async function requestLinkConfirmation(
  hapieatsUserId: string,
  munchorUser: MunchorUser,
  next: string,
): Promise<NextResponse> {
  const service = createServiceClient()

  const rawToken = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MINUTES * 60_000)

  const { error: insErr } = await service.from('munchor_link_requests').insert({
    token_hash: sha256(rawToken),
    hapieats_user_id: hapieatsUserId,
    munchor_user_id: munchorUser.id,
    munchor_email: munchorUser.email,
    expires_at: expiresAt.toISOString(),
  })
  if (insErr) {
    console.error('[munchor/login] link request insert failed:', insErr)
    return NextResponse.json({ error: 'Could not start the confirmation' }, { status: 500 })
  }

  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')
  const redirectTo =
    `${origin}/api/auth/munchor/confirm` +
    `?token=${encodeURIComponent(rawToken)}` +
    `&next=${encodeURIComponent(next)}`

  // Reuse the magic-link email HapiEats already sends on the login page. The
  // click both authenticates the address and completes the link, so ownership
  // is proven cryptographically rather than merely asserted.
  const supabase = createClient()
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email: munchorUser.email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  })
  if (otpErr) {
    console.error('[munchor/login] confirmation email failed:', otpErr.message)
    return NextResponse.json(
      { error: 'Could not send the confirmation email — please try again.' },
      { status: 502 },
    )
  }

  return NextResponse.json({
    status: 'confirmation_required',
    email: munchorUser.email,
    message:
      'A HapiEats TV account already uses this email. We sent a confirmation link to it — ' +
      'open it to connect your Munchor account.',
  })
}

export async function POST(req: NextRequest) {
  if (!isMunchorConfigured()) {
    return NextResponse.json(
      { error: 'Munchor sign-in is not configured yet.' },
      { status: 503 },
    )
  }

  let body: { email?: string; password?: string; next?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  // Throttle by email and by IP: the email bucket slows an attack on one
  // account, the IP bucket slows spraying across many.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  for (const key of [`munchor_login:email:${email}`, `munchor_login:ip:${ip}`]) {
    if (!checkRateLimit(key, 8, 10 * 60_000).allowed) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts — please wait a few minutes.' },
        { status: 429 },
      )
    }
  }

  // ── 1. Verify against Munchor ────────────────────────────────────────────
  const auth = await authenticateWithMunchor(email, password)
  if (!auth.ok) {
    if (auth.reason === 'not_configured') {
      return NextResponse.json({ error: 'Munchor sign-in is not configured yet.' }, { status: 503 })
    }
    // Deliberately identical for "no such user" and "wrong password" so this
    // endpoint cannot be used to enumerate Munchor accounts.
    return NextResponse.json({ error: 'Incorrect Munchor email or password' }, { status: 401 })
  }
  const munchorUser = auth.user
  const service = createServiceClient()

  // ── 2. Already linked? ───────────────────────────────────────────────────
  const { data: existingLink } = await service
    .from('munchor_identities')
    .select('hapieats_user_id, munchor_email')
    .eq('munchor_user_id', munchorUser.id)
    .maybeSingle()

  if (existingLink) {
    const { data: linked } = await service.auth.admin.getUserById(existingLink.hapieats_user_id)
    const linkedEmail = linked?.user?.email
    if (!linkedEmail) {
      return NextResponse.json({ error: 'Linked HapiEats account is unavailable' }, { status: 409 })
    }

    const session = await signInAs(linkedEmail)
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: 500 })

    await service
      .from('munchor_identities')
      .update({ last_login_at: new Date().toISOString() })
      .eq('munchor_user_id', munchorUser.id)

    return NextResponse.json({ status: 'signed_in', linked: true })
  }

  // ── 3. Is there already a HapiEats account on this email? ────────────────
  // public.profiles has no email column (see 001_initial.sql), so auth.users is
  // the only authoritative place to resolve an address. The RPC does an exact,
  // case-insensitive match — a `like` here would treat the `_` and `%` that are
  // legal in an email local-part as wildcards and match the wrong account.
  const { data: existingUserId, error: lookupErr } = await service.rpc(
    'find_user_id_by_email',
    { p_email: munchorUser.email },
  )
  if (lookupErr) {
    console.error('[munchor/login] email lookup failed:', lookupErr)
    return NextResponse.json({ error: 'Could not complete sign-in' }, { status: 500 })
  }

  const next = typeof body.next === 'string' && body.next.startsWith('/') ? body.next : '/dashboard'

  if (existingUserId) {
    // Case 3 — never merge without proof of ownership.
    return requestLinkConfirmation(existingUserId as string, munchorUser, next)
  }

  // ── 4. Nobody here yet — create the HapiEats account ─────────────────────
  // Whether they get signed straight in depends on whether Munchor verified
  // the address; that check happens after the account exists, because an
  // unconfirmed user still needs a row to attach the confirmation to.
  const username = await pickAvailableUsername(service, usernameFromMunchor(munchorUser))

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: munchorUser.email,
    email_confirm: munchorUser.emailConfirmed,
    user_metadata: {
      full_name: munchorUser.displayName ?? undefined,
      avatar_url: munchorUser.avatarUrl ?? undefined,
      username,
      provider: 'munchor',
    },
  })

  if (createErr || !created?.user) {
    console.error('[munchor/login] createUser failed:', createErr?.message)
    return NextResponse.json({ error: 'Could not create a HapiEats account' }, { status: 500 })
  }
  const newUserId = created.user.id

  // Profile row — the handle_new_user trigger may already have made one.
  const { data: hasProfile } = await service
    .from('profiles')
    .select('id')
    .eq('id', newUserId)
    .maybeSingle()

  if (!hasProfile) {
    const { error: profileErr } = await service.from('profiles').insert({
      id: newUserId,
      username,
      display_name: munchorUser.displayName ?? username,
      avatar_url: munchorUser.avatarUrl,
      role: 'user',
    })
    // A duplicate here means the trigger won the race — harmless.
    if (profileErr && (profileErr as { code?: string }).code !== '23505') {
      console.error('[munchor/login] profile insert failed:', profileErr)
    }
  }

  // ── 5. Munchor never verified this address ───────────────────────────────
  // An unverified address is not evidence of ownership, so require the same
  // magic-link round trip even though there was no pre-existing account.
  if (!munchorUser.emailConfirmed) {
    return requestLinkConfirmation(newUserId, munchorUser, next)
  }

  // ── 6. Verified and unclaimed — link and sign in ─────────────────────────

  const { error: linkErr } = await service.from('munchor_identities').insert({
    hapieats_user_id: newUserId,
    munchor_user_id: munchorUser.id,
    munchor_email: munchorUser.email,
    last_login_at: new Date().toISOString(),
  })
  if (linkErr) {
    console.error('[munchor/login] link insert failed:', linkErr)
    return NextResponse.json({ error: 'Could not connect your Munchor account' }, { status: 500 })
  }

  const session = await signInAs(munchorUser.email)
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: 500 })

  return NextResponse.json({ status: 'signed_in', created: true })
}
