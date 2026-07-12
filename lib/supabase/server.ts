import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

/**
 * User-scoped Supabase client.
 *
 * Two auth transports (checked in order):
 *  1. Authorization: Bearer <access_token> — used by the mobile app (Expo).
 *  2. Supabase auth cookies — used by the web app (unchanged behavior).
 *
 * The Bearer path is purely additive: web requests carry no Authorization
 * header, so the cookie flow below is untouched.
 */
export function createClient() {
  // ── Mobile: Bearer token ────────────────────────────────────────────────
  let bearer: string | null = null
  try {
    const auth = headers().get('authorization')
    if (auth?.toLowerCase().startsWith('bearer ')) bearer = auth.slice(7).trim()
  } catch {
    // headers() unavailable (e.g. during static generation) — fall through
  }

  if (bearer) {
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    )
    // Routes call auth.getUser() with no args expecting the session user.
    // There is no cookie session here, so default to validating the bearer JWT.
    const originalGetUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = ((jwt?: string) =>
      originalGetUser(jwt ?? bearer!)) as typeof client.auth.getUser
    return client
  }

  // ── Web: cookie-based (original behavior) ───────────────────────────────
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookies can't be set here
          }
        },
      },
    }
  )
}

/** Service-role client — bypasses RLS. Server-side only. */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
