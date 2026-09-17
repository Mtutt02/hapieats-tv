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

export function isMunchorConfigured(): boolean {
  const url = process.env.MUNCHOR_SUPABASE_URL
  const key = process.env.MUNCHOR_SUPABASE_ANON_KEY
  return Boolean(
    url && key && url.startsWith('https://') && !url.includes('placeholder') && key.length > 20,
  )
}

function munchorClient() {
  return createSupabaseClient(
    process.env.MUNCHOR_SUPABASE_URL!,
    process.env.MUNCHOR_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
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
