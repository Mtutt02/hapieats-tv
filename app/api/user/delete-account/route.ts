import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { confirmation } = await req.json()
  if (confirmation !== 'DELETE') {
    return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 })
  }

  const service = createServiceClient()

  // Soft-delete: scrub personal data from profile
  const { error: profileError } = await service
    .from('profiles')
    .update({
      display_name: '[Deleted User]',
      bio: null,
      avatar_url: null,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // Hard-delete the Supabase Auth record so the user cannot sign back in
  const { error: authError } = await service.auth.admin.deleteUser(user.id)
  if (authError) {
    // Log but don't block — profile is already scrubbed
    console.error('[delete-account] Failed to delete auth user:', authError.message)
  }

  return NextResponse.json({ success: true })
}
