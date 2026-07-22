import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/login
 *
 * Sign in with EITHER an email or a username, plus a password.
 *
 * Username sign-in has to happen server-side: Supabase's signInWithPassword
 * only accepts an email, and resolving username -> email on the client would
 * leak account emails (and allow username enumeration). Here the lookup uses
 * the service client, the sign-in happens on the cookie-based server client so
 * the session cookies are set on the response, and the email is never returned.
 */
export async function POST(req: NextRequest) {
  const { identifier, password } = await req.json().catch(() => ({}))

  if (!identifier || !password) {
    return NextResponse.json({ error: 'Enter your email or username and password' }, { status: 400 })
  }

  let email = String(identifier).trim()

  // Not an email -> treat as a username and resolve to the account email.
  if (!email.includes('@')) {
    const service = createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('email')
      .ilike('username', email)
      .single()
    // If the username doesn't exist, fall through with an empty email so the
    // sign-in fails identically to a wrong password — no enumeration signal.
    email = profile?.email ?? ''
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid login credentials' }, { status: 401 })
  }

  // Return the role so the client can route admins straight to /admin.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  return NextResponse.json({ success: true, role: profile?.role ?? 'user' })
}
