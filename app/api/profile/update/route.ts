import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { display_name?: string; bio?: string | null; avatar_url?: string | null }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.display_name !== undefined) {
    const name = body.display_name.trim()
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: 'Display name must be between 2 and 80 characters.' },
        { status: 400 }
      )
    }
    updates.display_name = name
  }

  if (body.bio !== undefined) {
    if (body.bio && body.bio.length > 300) {
      return NextResponse.json(
        { error: 'Bio must be 300 characters or fewer.' },
        { status: 400 }
      )
    }
    updates.bio = body.bio || null
  }

  if (body.avatar_url !== undefined) {
    if (body.avatar_url) {
      // Validate it's a proper https URL pointing to an allowed image host
      let parsedUrl: URL
      try {
        parsedUrl = new URL(body.avatar_url)
      } catch {
        return NextResponse.json({ error: 'Invalid avatar URL.' }, { status: 400 })
      }
      if (parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ error: 'Avatar URL must use HTTPS.' }, { status: 400 })
      }
      const allowed = ['images.unsplash.com', 'avatars.githubusercontent.com', 'lh3.googleusercontent.com', 'hjvmpltmhxpvrewncnev.supabase.co']
      if (!allowed.some(host => parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host))) {
        return NextResponse.json({ error: 'Avatar URL must be from an allowed image host.' }, { status: 400 })
      }
    }
    updates.avatar_url = body.avatar_url || null
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}
