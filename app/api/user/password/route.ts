import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/user/password
 *
 * Change the signed-in user's password. The caller must supply the CURRENT
 * password, which is verified via a throwaway (non-persisting) client before
 * the change is applied. This prevents an unattended, already-authenticated
 * session from being used to silently take over the account.
 */
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json().catch(() => ({}))

  if (!currentPassword) {
    return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
  }
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'New password must be different from your current password' }, { status: 400 })
  }

  // Verify the current password on a throwaway client so we don't disturb the
  // active session's cookies. A failed sign-in means the current password is wrong.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (verifyError) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
