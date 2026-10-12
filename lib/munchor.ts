import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Munchor identity provider.
 *
 * Munchor runs on its own Supabase project. HapiEats never trusts a caller's
 * claim about who they are on Munchor — it authenticates against Munchor's
 * auth server directly and uses whatever that returns as the source of truth.
 *
 * Required env (server-side only — none of these are NEXT_PUBLIC):
 *   MUNCHOR_SUPABASE_URL       https://<munchor-ref>.supabase.co
 *   MUNCHOR_SUPABASE_ANON_KEY  Munchor's anon/publishable key
 *
 * The anon key is all that is needed: we only ever call the sign-in endpoint,
 * never anything privileged. Munchor's service-role key must NOT be used here.
 */

export interface MunchorUser {
  id: string
  /** Lower-cased. Null for Munchor accounts created with a phone number only. */
  email: string | null
  /** Whether Munchor itself has verified this address. */
  emailConfirmed: boolean
  /** E.164, as Munchor stores it (without the leading +). Null when none. */
  phone: string | null
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Resolve the Munchor credentials.
 *
 * Two sources, checked in order:
 *   1. Environment variables (MUNCHOR_SUPABASE_URL / MUNCHOR_SUPABASE_ANON_KEY)
 *   2. The `munchor_sso` row in platform_settings
 *
 * The database fallback exists because Vercel only applies environment
 * variables to deployments created after they are saved, so setting them is a
 * two-step dance (save, then redeploy) that is easy to get half-done. A
 * platform_settings row is read per request and takes effect immediately.
 *
 * Only the ANON key belongs here either way. It is public by design — it ships
 * in Munchor's own client bundles — so holding it in an admin-only table is no
 * weaker than holding it in an env var. Munchor's service-role key must never
 * be stored in either place.
 */

/** Accept the URL forms people actually paste; reject genuine nonsense. */
function normalizeUrl(value: string | null | undefined): string | null {
  const raw = value?.trim().replace(/\/+$/, '')
  if (!raw || raw.includes('placeholder')) return null
  if (raw.startsWith('https://')) return raw
  if (raw.startsWith('http://')) return `https://${raw.slice(7)}`
  if (/^[\w-]+\.[\w.-]+$/.test(raw)) return `https://${raw}`   // bare host
  return null
}

function normalizeKey(value: string | null | undefined): string | null {
  const key = value?.trim()
  if (!key || key.length <= 20 || key.includes('placeholder')) return null
  return key
}

export interface MunchorConfig {
  url: string
  key: string
  source: 'env' | 'database'
}

/** The HapiEats Supabase project ref this deployment talks to. Public — it ships in the client bundle. */
function supabaseRef(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname.split('.')[0] || 'unknown'
  } catch {
    return 'unknown'
  }
}

interface DatabaseConfig {
  url: string | null
  key: string | null
  /** Why the row could not be read, or whether it was absent. Never contains values. */
  diagnosis: string | null
}

/**
 * Read the `munchor_sso` settings row, if present.
 *
 * supabase-js reports query failures in `error` rather than throwing, so a
 * rejected service key or a blocked read used to come back as "no row" with
 * nothing logged. Surface the error so the status endpoint can say why.
 */
async function configFromDatabase(): Promise<DatabaseConfig> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const { data, error } = await createServiceClient()
      .from('platform_settings')
      .select('value')
      .eq('key', 'munchor_sso')
      .maybeSingle()

    if (error) {
      console.error('[munchor] could not read munchor_sso from platform_settings:', error)
      return {
        url: null,
        key: null,
        diagnosis: `munchor_sso row could not be read (${error.code ?? 'no code'}: ${error.message})`,
      }
    }
    if (!data) {
      return {
        url: null,
        key: null,
        diagnosis:
          `munchor_sso row not found in project ${supabaseRef()} — ` +
          'either it is not there, or SUPABASE_SERVICE_ROLE_KEY belongs to another project',
      }
    }

    const v = (data.value ?? null) as { url?: string; anon_key?: string } | null
    return { url: normalizeUrl(v?.url), key: normalizeKey(v?.anon_key), diagnosis: null }
  } catch (err) {
    console.error('[munchor] could not read munchor_sso from platform_settings:', err)
    return {
      url: null,
      key: null,
      diagnosis: `munchor_sso row could not be read (${err instanceof Error ? err.message : 'unknown error'})`,
    }
  }
}

export async function getMunchorConfig(): Promise<MunchorConfig | null> {
  const envUrl = normalizeUrl(process.env.MUNCHOR_SUPABASE_URL)
  const envKey = normalizeKey(process.env.MUNCHOR_SUPABASE_ANON_KEY)
  if (envUrl && envKey) return { url: envUrl, key: envKey, source: 'env' }

  const db = await configFromDatabase()
  if (db.url && db.key) return { url: db.url, key: db.key, source: 'database' }

  return null
}

export async function isMunchorConfigured(): Promise<boolean> {
  return (await getMunchorConfig()) !== null
}

/**
 * Why the feature is switched off, for the status endpoint.
 * Names what is missing — never the values themselves.
 */
export async function munchorConfigProblems(): Promise<string[]> {
  const envUrl = normalizeUrl(process.env.MUNCHOR_SUPABASE_URL)
  const envKey = normalizeKey(process.env.MUNCHOR_SUPABASE_ANON_KEY)
  if (envUrl && envKey) return []

  const db = await configFromDatabase()
  if (db.url && db.key) return []

  const problems: string[] = []
  if (db.diagnosis) problems.push(db.diagnosis)
  const rawEnvUrl = process.env.MUNCHOR_SUPABASE_URL?.trim()
  const rawEnvKey = process.env.MUNCHOR_SUPABASE_ANON_KEY?.trim()

  if (!envUrl && !db.url) {
    problems.push(
      rawEnvUrl
        ? 'Munchor URL is set but unusable (expected https://<ref>.supabase.co)'
        : 'Munchor URL is not set — add it via env var or the munchor_sso settings row',
    )
  }
  if (!envKey && !db.key) {
    problems.push(
      rawEnvKey
        ? 'Munchor anon key is set but looks too short to be real'
        : 'Munchor anon key is not set — add it via env var or the munchor_sso settings row',
    )
  }
  return problems
}

function munchorClient(config: MunchorConfig) {
  return createSupabaseClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type MunchorAuthResult =
  | { ok: true; user: MunchorUser }
  | { ok: false; reason: 'invalid_credentials' | 'not_configured' | 'error' }

/** Where a one-time code is sent: an email address or an E.164 phone number. */
export type MunchorCodeTarget = { email: string } | { phone: string }

type SupabaseAuthUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  phone?: string | null
  user_metadata?: Record<string, unknown> | null
}

/** Map a Munchor auth user onto the shape HapiEats works with. */
function toMunchorUser(u: SupabaseAuthUser): MunchorUser {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  return {
    id: u.id,
    email: u.email ? u.email.toLowerCase() : null,
    emailConfirmed: Boolean(u.email && u.email_confirmed_at),
    phone: u.phone ? u.phone : null,
    displayName:
      str(meta.full_name) ?? str(meta.display_name) ?? str(meta.name) ?? str(meta.username),
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture),
  }
}

/**
 * Best-effort E.164, matching Munchor's own login (src/lib/phone.ts there):
 * keeps an explicit +country code, assumes US/Canada for a bare 10-digit
 * number. Returns null when it cannot be sure, so a code is never texted to a
 * guess.
 */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/[^\d]/g, '')
  if (trimmed.startsWith('+')) return digits.length >= 8 ? `+${digits}` : null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/** Discard a Munchor session we only needed long enough to learn who the user is. */
async function dropMunchorSession(
  munchor: ReturnType<typeof munchorClient>,
  accessToken?: string,
): Promise<void> {
  try {
    if (accessToken) await munchor.auth.admin.signOut(accessToken, 'local')
    else await munchor.auth.signOut()
  } catch {
    /* best-effort; nothing is persisted on our side anyway */
  }
}

/**
 * Verify an email/password pair against Munchor.
 *
 * Returns the Munchor user on success. The Munchor session itself is discarded
 * — HapiEats only needs the verified identity, and holding another project's
 * refresh token would be a liability with no upside.
 */
export async function authenticateWithMunchor(
  email: string,
  password: string,
): Promise<MunchorAuthResult> {
  const config = await getMunchorConfig()
  if (!config) return { ok: false, reason: 'not_configured' }

  const munchor = munchorClient(config)
  try {
    const res = await munchor.auth.signInWithPassword({ email, password })
    if (res.error || !res.data?.user) return { ok: false, reason: 'invalid_credentials' }
    await dropMunchorSession(munchor)
    return { ok: true, user: toMunchorUser(res.data.user) }
  } catch (err) {
    console.error('[munchor] password sign-in request failed:', err)
    return { ok: false, reason: 'error' }
  }
}

/**
 * Verify a username/password pair, the way Munchor's own login does.
 *
 * Munchor resolves usernames server-side in its `username-login` edge function
 * (so it never discloses which emails exist) and returns a session. We read the
 * user from that session and then revoke it.
 */
export async function authenticateWithMunchorUsername(
  username: string,
  password: string,
): Promise<MunchorAuthResult> {
  const config = await getMunchorConfig()
  if (!config) return { ok: false, reason: 'not_configured' }

  let accessToken: string | undefined
  try {
    const res = await fetch(`${config.url}/functions/v1/username-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as { access_token?: string }
    if (res.status >= 500) {
      console.error('[munchor] username-login failed with status', res.status)
      return { ok: false, reason: 'error' }
    }
    if (!res.ok || !data.access_token) return { ok: false, reason: 'invalid_credentials' }
    accessToken = data.access_token
  } catch (err) {
    console.error('[munchor] username-login request failed:', err)
    return { ok: false, reason: 'error' }
  }

  const munchor = munchorClient(config)
  try {
    const { data, error } = await munchor.auth.getUser(accessToken)
    if (error || !data?.user) return { ok: false, reason: 'error' }
    return { ok: true, user: toMunchorUser(data.user) }
  } catch (err) {
    console.error('[munchor] could not read the user behind a username sign-in:', err)
    return { ok: false, reason: 'error' }
  } finally {
    await dropMunchorSession(munchor, accessToken)
  }
}

export type MunchorSendCodeResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'rate_limited' | 'error'; message?: string }

/**
 * Ask Munchor to email or text a 6-digit sign-in code — the same code its own
 * app uses for "email me a code" and phone login.
 *
 * `shouldCreateUser: false`: this is sign-in only. HapiEats must never create
 * Munchor accounts. An unknown address or number is reported as success so this
 * endpoint cannot be used to discover who has a Munchor account.
 */
export async function sendMunchorCode(target: MunchorCodeTarget): Promise<MunchorSendCodeResult> {
  const config = await getMunchorConfig()
  if (!config) return { ok: false, reason: 'not_configured' }

  const munchor = munchorClient(config)
  try {
    const { error } = await munchor.auth.signInWithOtp({
      ...target,
      options: { shouldCreateUser: false },
    })
    if (!error) return { ok: true }

    const code = (error as { code?: string }).code ?? ''
    const status = (error as { status?: number }).status ?? 0
    if (code === 'otp_disabled' || /signups? not allowed|user not found/i.test(error.message)) {
      return { ok: true } // unknown account — deliberately indistinguishable from success
    }
    if (status === 429 || /rate limit|too many|security purposes/i.test(error.message)) {
      return { ok: false, reason: 'rate_limited', message: error.message }
    }
    console.error('[munchor] sending a sign-in code failed:', code, error.message)
    return { ok: false, reason: 'error', message: error.message }
  } catch (err) {
    console.error('[munchor] sign-in code request failed:', err)
    return { ok: false, reason: 'error' }
  }
}

/** Check a 6-digit code from Munchor's email or text and return who it belongs to. */
export async function verifyMunchorCode(
  target: MunchorCodeTarget,
  token: string,
): Promise<MunchorAuthResult> {
  const config = await getMunchorConfig()
  if (!config) return { ok: false, reason: 'not_configured' }

  const munchor = munchorClient(config)
  try {
    const { data, error } =
      'email' in target
        ? await munchor.auth.verifyOtp({ email: target.email, token, type: 'email' })
        : await munchor.auth.verifyOtp({ phone: target.phone, token, type: 'sms' })
    if (error || !data?.user) return { ok: false, reason: 'invalid_credentials' }
    await dropMunchorSession(munchor, data.session?.access_token)
    return { ok: true, user: toMunchorUser(data.user) }
  } catch (err) {
    console.error('[munchor] verifying a sign-in code failed:', err)
    return { ok: false, reason: 'error' }
  }
}

/**
 * Derive a HapiEats username from a Munchor identity.
 * Mirrors the sanitising done in /auth/callback so both paths agree.
 */
export function usernameFromMunchor(user: MunchorUser): string {
  const raw = user.displayName ?? user.email?.split('@')[0] ?? ''
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24)
  // Fall back to something stable and collision-resistant if nothing survives.
  return cleaned.length >= 3 ? cleaned : `munchor_${user.id.slice(0, 8)}`
}
