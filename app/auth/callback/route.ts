import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * /auth/callback
 *
 * Supabase redirects here after email verification.
 * 1. Exchange the one-time code for a session.
 * 2. Upsert the profiles row (belt-and-suspenders — the DB trigger should
 *    create it, but new installs may not have the trigger yet).
 * 3. Redirect to /dashboard (or whatever ?next= says).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get('code')
  const next     = searchParams.get('next') ?? '/dashboard'
  const redirect = searchParams.get('redirect') ?? next   // legacy compat

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('[auth/callback] exchange error:', error?.message)
    return NextResponse.redirect(`${origin}/login?error=verification_failed`)
  }

  const user    = data.user
  const service = createServiceClient()

  // Check whether a profile row already exists (trigger may have created it)
  const { data: existing } = await service
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!existing) {
    const meta        = (user.user_metadata ?? {}) as Record<string, string>
    const rawUsername = meta.username ?? `user_${user.id.slice(0, 8)}`
    const username    = rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30)

    const { error: insertErr } = await service.from('profiles').insert({
      id:           user.id,
      email:        user.email ?? '',
      username,
      display_name: meta.full_name ?? meta.username ?? username,
      avatar_url:   null,
      role:         'user',
    })

    if (insertErr) {
      // Profile already exists (race condition) — not fatal, continue
      console.warn('[auth/callback] profile insert skipped:', insertErr.code)
    }
  }

  return NextResponse.redirect(`${origin}${redirect}`)
}
