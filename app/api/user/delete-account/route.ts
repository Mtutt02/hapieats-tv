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
  const anonId = `deleted_${user.id.slice(0, 8)}`

  // Scrub all personal data from the profile (username is unique — anonymize it too)
  const { error: profileError } = await service
    .from('profiles')
    .update({
      username: anonId,
      display_name: '[Deleted User]',
      bio: null,
      avatar_url: null,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // Remove the user's public content and secrets (best-effort, never block deletion):
  await Promise.allSettled([
    // videos go private — no longer publicly attributable UGC
    service.from('videos').update({ visibility: 'private' }).eq('creator_id', user.id),
    // end streams + rotate out the stream key secret
    service.from('live_streams').update({ status: 'ended', stream_key: 'revoked' }).eq('creator_id', user.id),
  ])

  // Hard-delete the Supabase Auth record (removes email/credentials, prevents sign-in)
  const { error: authError } = await service.auth.admin.deleteUser(user.id)
  if (authError) {
    // Log but don't block — profile is already scrubbed
    console.error('[delete-account] Failed to delete auth user:', authError.message)
  }

  // Note: token/gift transaction records are retained (financial recordkeeping),
  // now linked only to the anonymized profile id.
  return NextResponse.json({ success: true })
}
