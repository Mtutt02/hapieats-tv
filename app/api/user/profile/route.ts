import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { displayName, username, bio } = await req.json()

  const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/

  // Validate displayName
  if (displayName !== undefined) {
    if (typeof displayName !== 'string' || displayName.trim().length < 2 || displayName.trim().length > 80) {
      return NextResponse.json({ error: 'Display name must be between 2 and 80 characters' }, { status: 400 })
    }
  }

  // Validate and check uniqueness of username
  if (username !== undefined) {
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
      return NextResponse.json({ error: 'Username must be 3–30 characters and contain only letters, numbers, or underscores' }, { status: 400 })
    }
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .single()
    if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  // Validate bio
  if (bio !== undefined && bio !== null) {
    if (typeof bio !== 'string' || bio.length > 500) {
      return NextResponse.json({ error: 'Bio must be 500 characters or fewer' }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      ...(displayName !== undefined && { display_name: displayName.trim() }),
      ...(username !== undefined && { username }),
      ...(bio !== undefined && { bio: bio || null }),
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
