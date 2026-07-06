import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// One-time setup endpoint — secured by ADMIN_SETUP_SECRET env var
// Call: POST /api/admin/setup  { "secret": "<ADMIN_SETUP_SECRET>", "adminEmail": "...", "adminPassword": "..." }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { secret, adminEmail, adminPassword } = body

  const setupSecret = process.env.ADMIN_SETUP_SECRET
  if (!setupSecret || secret !== setupSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const results: Record<string, unknown> = {}

  // ── 1. Run DB migrations ──────────────────────────────────────────────────
  const migrations = [
    // Add role column to profiles
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'creator', 'admin', 'superadmin'))`,
    // Add suspension columns
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ NULL`,
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT NULL`,
    // Add flagging to videos
    `ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE videos ADD COLUMN IF NOT EXISTS flagged_reason TEXT NULL`,
    // Add flagging to comments
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false`,
    // Create content_reports table
    `CREATE TABLE IF NOT EXISTS content_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK (target_type IN ('video', 'comment', 'channel', 'user')),
      target_id UUID NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
      reviewed_by UUID REFERENCES profiles(id),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY`,
  ]

  const migrationResults: string[] = []
  for (const sql of migrations) {
    // supabase.rpc returns { data, error } and never throws
    const { error } = await supabase.rpc('exec_sql', { sql })
    migrationResults.push(error ? `WARN: ${error.message}` : 'OK')
  }
  results.migrations = migrationResults

  // ── 2. Create super admin user ────────────────────────────────────────────
  if (adminEmail && adminPassword) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    })

    if (authError) {
      results.adminUser = { error: authError.message }
    } else {
      const userId = authData.user.id
      results.adminUser = { id: userId, email: adminEmail }

      // Upsert profile with superadmin role
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          username: 'superadmin',
          display_name: 'Super Admin',
          role: 'superadmin',
          is_creator: false,
        }, { onConflict: 'id' })

      if (profileError) {
        // If profile already exists, just update the role
        await supabase
          .from('profiles')
          .update({ role: 'superadmin', display_name: 'Super Admin' })
          .eq('id', userId)
      }

      results.profileSet = profileError ? `Updated existing: ${profileError.message}` : 'Created'
    }
  }

  return NextResponse.json({ success: true, results })
}
