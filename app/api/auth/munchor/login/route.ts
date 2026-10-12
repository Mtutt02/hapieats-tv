import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  authenticateWithMunchor,
  authenticateWithMunchorUsername,
  isMunchorConfigured,
  toE164,
  usernameFromMunchor,
  verifyMunchorCode,
  type MunchorAuthResult,
  type MunchorUser,
} from '@/lib/munchor'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/munchor/login
 * Body, one of:
 *   { method: 'password', identifier, password, next? }  identifier = email or username
 *   { method: 'code', email, code, next? }                code from Munchor's email
 *   { method: 'code', phone, code, next? }                code from Munchor's text
 *   { email, password, next? }                            legacy shape, = password
 *
 * The same ways in as Munchor's own login. Codes are sent by
 * /api/auth/munchor/send-code and checked against Munchor here.
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
  munchorUser: MunchorUser & { email: string },
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

/**
 * Address used for the HapiEats account of a Munchor user who has no usable
 * email (a phone-only Munchor account). Derived from the Munchor id, so it is
 * unique per Munchor account and can only ever be reached through that
 * account's link. Nothing is ever sent to it: sessions are minted server-side.
 */
const phoneOnlyEmail = (munchorUserId: string) => `munchor-${munchorUserId}@users.hapieatstv.com`

/** Create the HapiEats auth user + profile for a Munchor identity. */
async function createHapieatsAccount(
  munchorUser: MunchorUser,
  email: string,
  emailConfirmed: boolean,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const service = createServiceClient()
  const username = await pickAvailableUsername(service, usernameFromMunchor(munchorUser))

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    email_confirm: emailConfirmed,
    user_metadata: {
      full_name: munchorUser.displayName ?? undefined,
      avatar_url: munchorUser.avatarUrl ?? undefined,
      username,
      provider: 'munchor',
    },
  })
  if (createErr || !created?.user) {
    console.error('[munchor/login] createUser failed:', createErr?.message)
    return { ok: false }
  }
  const id = created.user.id

  // Profile row — the handle_new_user trigger may already have made one.
  const { data: hasProfile } = await service.from('profiles').select('id').eq('id', id).maybeSingle()
  if (!hasProfile) {
    const { error: profileErr } = await service.from('profiles').insert({
      id,
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
  return { ok: true, id }
}

/** Record the HapiEats <-> Munchor link. An existing identical link is fine. */
async function linkAccounts(hapieatsUserId: string, munchorUser: MunchorUser): Promise<boolean> {
  const { error } = await createServiceClient().from('munchor_identities').insert({
    hapieats_user_id: hapieatsUserId,
    munchor_user_id: munchorUser.id,
    // NOT NULL column; a phone-only Munchor account is recorded by its number.
    munchor_email: munchorUser.email ?? (munchorUser.phone ? `+${munchorUser.phone.replace(/^\+/, '')}` : ''),
    last_login_at: new Date().toISOString(),
  })
  if (error && (error as { code?: string }).code !== '23505') {
    console.error('[munchor/login] link insert failed:', error)
    return false
  }
  return true
}

async function linkAndSignIn(
  hapieatsUserId: string,
  email: string,
  munchorUser: MunchorUser,
  extra: Record<string, unknown> = {},
): Promise<NextResponse> {
  if (!(await linkAccounts(hapieatsUserId, munchorUser))) {
    return NextResponse.json({ error: 'Could not connect your Munchor account' }, { status: 500 })
  }
  const session = await signInAs(email)
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: 500 })
  return NextResponse.json({ status: 'signed_in', ...extra })
}

type Proof = 'password' | 'email_code' | 'phone_code'

export async function POST(req: NextRequest) {
  if (!(await isMunchorConfigured())) {
    return NextResponse.json(
      { error: 'Munchor sign-in is not configured yet.' },
      { status: 503 },
    )
  }

  let body: {
    method?: string
    identifier?: string
    email?: string
    phone?: string
    password?: string
    code?: string
    next?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  const throttled = (subject: string) =>
    [`munchor_login:${subject}`, `munchor_login:ip:${ip}`].some(
      (key) => !checkRateLimit(key, 8, 10 * 60_000).allowed,
    )
  const tooMany = () =>
    NextResponse.json(
      { error: 'Too many sign-in attempts — please wait a few minutes.' },
      { status: 429 },
    )

  // ── 1. Verify with Munchor, by whichever method the user chose ───────────
  let proof: Proof
  let auth: MunchorAuthResult

  if (body.method === 'code') {
    const code = (body.code ?? '').replace(/\s/g, '')
    if (!/^\d{6,10}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the code Munchor sent you' }, { status: 400 })
    }
    if (typeof body.phone === 'string' && body.phone.trim()) {
      const phone = toE164(body.phone)
      if (!phone) return NextResponse.json({ error: 'Enter a full phone number' }, { status: 400 })
      if (throttled(`phone:${phone}`)) return tooMany()
      proof = 'phone_code'
      auth = await verifyMunchorCode({ phone }, code)
    } else {
      const email = (body.email ?? '').trim().toLowerCase()
      if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      if (throttled(`email:${email}`)) return tooMany()
      proof = 'email_code'
      auth = await verifyMunchorCode({ email }, code)
    }
    if (!auth.ok && auth.reason === 'invalid_credentials') {
      return NextResponse.json(
        { error: 'That code is wrong or has expired — request a new one.' },
        { status: 401 },
      )
    }
  } else {
    const identifier = (body.identifier ?? body.email ?? '').trim()
    const password = body.password ?? ''
    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email or username and password are required' },
        { status: 400 },
      )
    }
    // Throttle by identifier and by IP: the first slows an attack on one
    // account, the second slows spraying across many.
    if (throttled(identifier.toLowerCase())) return tooMany()
    proof = 'password'
    auth = identifier.includes('@')
      ? await authenticateWithMunchor(identifier.toLowerCase(), password)
      : await authenticateWithMunchorUsername(identifier.replace(/^@/, ''), password)
    if (!auth.ok && auth.reason === 'invalid_credentials') {
      // Identical for "no such user" and "wrong password" so this endpoint
      // cannot be used to enumerate Munchor accounts.
      return NextResponse.json({ error: 'Incorrect Munchor login or password' }, { status: 401 })
    }
  }

  if (!auth.ok) {
    if (auth.reason === 'not_configured') {
      return NextResponse.json({ error: 'Munchor sign-in is not configured yet.' }, { status: 503 })
    }
    return NextResponse.json(
      { error: 'Could not reach Munchor — please try again.' },
      { status: 502 },
    )
  }

  const munchorUser = auth.user
  const service = createServiceClient()
  const next = typeof body.next === 'string' && body.next.startsWith('/') ? body.next : '/dashboard'

  // ── 2. Already linked? ───────────────────────────────────────────────────
  const { data: existingLink } = await service
    .from('munchor_identities')
    .select('hapieats_user_id')
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

  // Which email may HapiEats act on? Munchor must have verified it, or the
  // user must have just proven the mailbox by typing the code sent to it.
  const mailboxProvenNow = proof === 'email_code'
  const email = munchorUser.email
  const emailTrusted = Boolean(email) && (munchorUser.emailConfirmed || mailboxProvenNow)

  if (email && (emailTrusted || proof === 'password')) {
    const withEmail = { ...munchorUser, email }

    // ── 3. Is there already a HapiEats account on this email? ──────────────
    // public.profiles has no reliable email column, so auth.users is the only
    // authoritative place to resolve an address. The RPC does an exact,
    // case-insensitive match — a `like` here would treat the `_` and `%` that
    // are legal in an email local-part as wildcards and match the wrong account.
    const { data: existingUserId, error: lookupErr } = await service.rpc(
      'find_user_id_by_email',
      { p_email: email },
    )
    if (lookupErr) {
      console.error('[munchor/login] email lookup failed:', lookupErr)
      return NextResponse.json({ error: 'Could not complete sign-in' }, { status: 500 })
    }

    if (existingUserId) {
      // Typing the code Munchor emailed to this address IS proof of the
      // mailbox — the same proof our own magic link would give — so link now.
      if (mailboxProvenNow) return linkAndSignIn(existingUserId as string, email, munchorUser)
      // Otherwise never merge without proof of ownership (the whole point:
      // anyone who could register a Munchor account under someone else's
      // address must not walk into that person's HapiEats account).
      return requestLinkConfirmation(existingUserId as string, withEmail, next)
    }

    // ── 4. Nobody here yet — create the HapiEats account ───────────────────
    const created = await createHapieatsAccount(munchorUser, email, emailTrusted)
    if (!created.ok) {
      return NextResponse.json({ error: 'Could not create a HapiEats account' }, { status: 500 })
    }

    // ── 5. An unverified address is not evidence of ownership ──────────────
    if (!emailTrusted) return requestLinkConfirmation(created.id, withEmail, next)

    // ── 6. Verified and unclaimed — link and sign in ───────────────────────
    return linkAndSignIn(created.id, email, munchorUser, { created: true })
  }

  // ── 7. Phone sign-in, and Munchor holds no usable email for this person ──
  // The number was just proven by the texted code. The HapiEats account gets a
  // private placeholder address tied to this Munchor id (nothing is sent to it).
  if (proof !== 'phone_code') {
    return NextResponse.json({ error: 'Could not complete sign-in' }, { status: 409 })
  }
  const placeholder = phoneOnlyEmail(munchorUser.id)
  const { data: priorId } = await service.rpc('find_user_id_by_email', { p_email: placeholder })
  if (priorId) return linkAndSignIn(priorId as string, placeholder, munchorUser)

  const created = await createHapieatsAccount(munchorUser, placeholder, true)
  if (!created.ok) {
    return NextResponse.json({ error: 'Could not create a HapiEats account' }, { status: 500 })
  }
  return linkAndSignIn(created.id, placeholder, munchorUser, { created: true })
}
