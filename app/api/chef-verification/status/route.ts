import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await (await supabase).auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the user's profile verification status
  const { data: profile } = await (await supabase)
    .from('profiles')
    .select('is_verified_chef, display_name, username')
    .eq('id', user.id)
    .single()

  // Get their application if one exists
  const { data: application, error: appError } = await (await supabase)
    .from('chef_verification_applications')
    .select('id, status, credential_type, credential_detail, created_at, reviewed_at, denial_reason')
    .eq('user_id', user.id)
    .maybeSingle()

  if (appError) {
    console.error('chef_verification status error:', appError)
    return NextResponse.json({ error: 'Failed to fetch verification status' }, { status: 500 })
  }

  return NextResponse.json({
    is_verified_chef: profile?.is_verified_chef ?? false,
    application: application ?? null,
  })
}
