import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// GET — the caller's institutions (owned + membership)
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[academy/institutions] GET error:', error)
      return NextResponse.json({ error: 'Failed to load institutions' }, { status: 500 })
    }
    return NextResponse.json({ institutions: data ?? [] })
  } catch (err) {
    console.error('[academy/institutions] GET error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST — create an institution (owner = caller, unique slug, status 'pending')
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in to create an institution' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      name?: string
      slug?: string
      tagline?: string | null
      about?: string | null
      accreditation_body?: string | null
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: 'Name must be 2–120 characters' }, { status: 400 })
    }

    let slug = slugify(typeof body.slug === 'string' && body.slug.trim() ? body.slug : name)
    if (!slug) return NextResponse.json({ error: 'Could not derive a valid slug' }, { status: 400 })

    // Ensure uniqueness — append a short suffix if taken.
    const { data: taken } = await supabase
      .from('institutions')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle()
    if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

    const { data: inst, error } = await supabase
      .from('institutions')
      .insert({
        owner_id: user.id,
        name,
        slug,
        tagline: body.tagline?.toString().trim() || null,
        about: body.about?.toString().trim() || null,
        accreditation_body: body.accreditation_body?.toString().trim() || null,
        theme: {},
        status: 'pending',
      })
      .select('*')
      .single()

    if (error || !inst) {
      console.error('[academy/institutions] POST error:', error)
      return NextResponse.json({ error: 'Failed to create institution' }, { status: 500 })
    }

    // Owner is also an admin member.
    await supabase
      .from('institution_members')
      .insert({ institution_id: inst.id, user_id: user.id, role: 'admin' })

    return NextResponse.json({ institution: inst })
  } catch (err) {
    console.error('[academy/institutions] POST error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
