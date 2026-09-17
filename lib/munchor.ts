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
 * Normalize the configured Munchor URL.
 *
 * Supabase shows the project URL with the scheme, but it is easy to paste just
 * the host (`abc.supabase.co`) or leave a trailing slash or stray whitespace.
 * None of those are really misconfiguration, so accept them rather than
 * silently disabling the whole feature.
 */
export function munchorUrl(): string | null {
  const raw = process.env.MUNCHOR_SUPABASE_URL?.trim().replace(/\/+$/, '')
  if (!raw || raw.includes('placeholder')) return null
  if (raw.startsWith('https://')) return raw
  if (raw.startsWith('http://')) return `https://${raw.slice(7)}`
  if (/^[\w-]+\.[\w.-]+$/.test(raw)) return `https://${raw}`   // bare host
  return null
}

export function munchorKey(): string | null {
  const key = process.env.MUNCHOR_SUPABASE_ANON_KEY?.trim()
  if (!key || key.length <= 20 || key.includes('placeholder')) return null
  return key
}

export function isMunchorConfigured(): boolean {
  return Boolean(munchorUrl() && munchorKey())
}

/**
 * Why the feature is switched off, for the status endpoint.
 * Reports which check failed — never the values themselves.
 */
export function munchorConfigProblems(): string[] {
  const problems: string[] = []
  const rawUrl = process.env.MUNCHOR_SUPABASE_URL?.trim()
  const rawKey = process.env.MUNCHOR_SUPABASE_ANON_KEY?.trim()

  if (!rawUrl) problems.push('MUNCHOR_SUPABASE_URL is not set on this deployment')
  else if (rawUrl.includes('placeholder')) problems.push('MUNCHOR_SUPABASE_URL still contains "placeholder"')
  else if (!munchorUrl()) problems.push('MUNCHOR_SUPABASE_URL is not a usable URL (expected https://<ref>.supabase.co)')

  if (!rawKey) problems.push('MUNCHOR_SUPABASE_ANON_KEY is not set on this deployment')
  else if (rawKey.includes('placeholder')) problems.push('MUNCHOR_SUPABASE_ANON_KEY still contains "placeholder"')
  else if (rawKey.length <= 20) problems.push('MUNCHOR_SUPABASE_ANON_KEY looks too short to be a real key')

  return problems
}

function munchorClient() {
  return createSupabaseClient(munchorUrl()!, munchorKey()!, {
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
  if (!isMunchorConfigured()) return { ok: false, reason: 'not_configured' }

  const munchor = munchorClient()

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
