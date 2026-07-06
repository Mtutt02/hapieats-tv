import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/** Verify that the calling user is admin or superadmin */
async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await (await supabase).auth.getUser()

  if (authError || !user) return { error: 'Unauthorized', status: 401, user: null, supabase: null }

  const { data: profile } = await (await supabase)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return { error: 'Forbidden', status: 403, user: null, supabase: null }
  }

  return { error: null, status: 200, user, supabase: await supabase }
}

/** GET /api/admin/chef-verification — list all pending applications */
export async function GET() {
  const { error, status, supabase } = await requireAdmin()
  if (error || !supabase) return NextResponse.json({ error }, { status })

  const { data, error: fetchError } = await supabase
    .from('chef_verification_applications')
    .select(`
      id,
      status,
      credential_type,
      credential_detail,
      portfolio_url,
      social_proof,
      additional_notes,
      created_at,
      reviewed_at,
      denial_reason,
      profiles!chef_verification_applications_user_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (fetchError) {
    console.error('admin chef_verification GET error:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }

  return NextResponse.json({ applications: data })
}

/** PATCH /api/admin/chef-verification — approve or deny an application */
export async function PATCH(request: Request) {
  const { error, status, user, supabase } = await requireAdmin()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { applicationId, action, denialReason } = body

  if (!applicationId || typeof applicationId !== 'string') {
    return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
  }

  if (action !== 'approve' && action !== 'deny') {
    return NextResponse.json({ error: 'action must be "approve" or "deny"' }, { status: 400 })
  }

  if (action === 'deny' && (!denialReason || typeof denialReason !== 'string' || !denialReason.trim())) {
    return NextResponse.json({ error: 'denialReason is required when denying an application' }, { status: 400 })
  }

  // Fetch the application to get the user_id
  const { data: application, error: fetchError } = await supabase
    .from('chef_verification_applications')
    .select('id, user_id, status')
    .eq('id', applicationId)
    .single()

  if (fetchError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.status !== 'pending') {
    return NextResponse.json({ error: 'Application has already been reviewed' }, { status: 409 })
  }

  // Use service client for profile update (bypasses RLS on other users)
  const serviceClient = createServiceClient()

  if (action === 'approve') {
    // Update application status
    const { error: appUpdateError } = await serviceClient
      .from('chef_verification_applications')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        denial_reason: null,
      })
      .eq('id', applicationId)

    if (appUpdateError) {
      console.error('chef_verification approve application error:', appUpdateError)
      return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
    }

    // Grant verified chef badge on profile
    const { error: profileUpdateError } = await serviceClient
      .from('profiles')
      .update({ is_verified_chef: true })
      .eq('id', application.user_id)

    if (profileUpdateError) {
      console.error('chef_verification approve profile error:', profileUpdateError)
      return NextResponse.json({ error: 'Application approved but failed to update profile badge' }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: 'approved', userId: application.user_id })
  }

  // action === 'deny'
  const { error: denyError } = await serviceClient
    .from('chef_verification_applications')
    .update({
      status: 'denied',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      denial_reason: (denialReason as string).trim(),
    })
    .eq('id', applicationId)

  if (denyError) {
    console.error('chef_verification deny error:', denyError)
    return NextResponse.json({ error: 'Failed to deny application' }, { status: 500 })
  }

  return NextResponse.json({ success: true, action: 'denied', userId: application.user_id })
}
