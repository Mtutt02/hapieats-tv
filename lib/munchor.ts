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
  email: string
  /** Whether Munchor itself has verified this address. */
  emailConfirmed: boolean
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

/** Read the `munchor_sso` settings row, if present. */
async function configFromDatabase(): Promise<{ url: string | null; key: string | null }> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const { data } = await createServiceClient()
      .from('platform_settings')
      .select('value')
      .eq('key', 'munchor_sso')
      .maybeSingle()

    const v = (data?.value ?? null) as { url?: string; anon_key?: string } | null
    return { url: normalizeUrl(v?.url), key: normalizeKey(v?.anon_key) }
  } catch (err) {
    console.error('[munchor] could not read munchor_sso from platform_settings:', err)
    return { url: null, key: null }
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

  let data
  try {
    const res = await munchor.auth.signInWithPassword({ email, password })
    if (res.error || !res.data?.user) return { ok: false, reason: 'invalid_credentials' }
    data = res.data
  } catch (err) {
    console.error('[munchor] sign-in request failed:', err)
    return { ok: false, reason: 'error' }
  }

  const u = data.user
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>

  // Drop the Munchor session immediately — we do not keep it.
  try {
    await munchor.auth.signOut()
  } catch {
    /* best-effort; the client is not persisted anyway */
  }

  if (!u.email) return { ok: false, reason: 'error' }

  return {
    ok: true,
    user: {
      id: u.id,
      email: u.email.toLowerCase(),
      emailConfirmed: Boolean(u.email_confirmed_at),
      displayName:
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.display_name === 'string' && meta.display_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        (typeof meta.username === 'string' && meta.username) ||
        null,
      avatarUrl:
        (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
        (typeof meta.picture === 'string' && meta.picture) ||
        null,
    },
  }
}

/**
 * Derive a HapiEats username from a Munchor identity.
 * Mirrors the sanitising done in /auth/callback so both paths agree.
 */
export function usernameFromMunchor(user: MunchorUser): string {
  const raw = user.displayName ?? user.email.split('@')[0] ?? ''
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24)
  // Fall back to something stable and collision-resistant if nothing survives.
  return cleaned.length >= 3 ? cleaned : `munchor_${user.id.slice(0, 8)}`
}
