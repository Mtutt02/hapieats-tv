import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeTheme } from '@/lib/academy/theme'

export const dynamic = 'force-dynamic'

// GET — public institution profile + its published programs & courses
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const supabase = createClient()

    const { data: inst, error } = await supabase
      .from('institutions')
      .select('*')
      .eq('slug', params.slug)
      .single()

    if (error || !inst) {
      return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
    }

    const { data: programs } = await supabase
      .from('programs')
      .select('id, title, slug, description, credential_tier, price, is_published, created_at')
      .eq('institution_id', inst.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    const { data: courses } = await supabase
      .from('courses')
      .select('id, title, description, category, level, price_usd, price, pricing_model, thumbnail_url, enrollment_count')
      .eq('institution_id', inst.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      institution: { ...inst, theme: sanitizeTheme(inst.theme) },
      programs: programs ?? [],
      courses: courses ?? [],
    })
  } catch (err) {
    console.error('[academy/institutions/[slug]] GET error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH — owner-only branding/profile update
export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: inst } = await supabase
      .from('institutions')
      .select('id, owner_id, theme')
      .eq('slug', params.slug)
      .single()

    if (!inst) return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
    if (inst.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only the owner can edit this institution' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const patch: Record<string, unknown> = {}

    const str = (k: string, max: number) => {
      if (typeof body[k] === 'string') {
        const v = (body[k] as string).trim()
        patch[k] = v ? v.slice(0, max) : null
      }
    }
    str('name', 120)
    str('tagline', 200)
    str('about', 5000)
    str('logo_url', 500)
    str('cover_url', 500)
    str('accreditation_body', 200)

    if (typeof patch.name === 'string' && patch.name.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 })
    }

    if (body.theme && typeof body.theme === 'object') {
      // Merge onto existing, then re-sanitize — only safe keys survive.
      patch.theme = sanitizeTheme({ ...(inst.theme as object), ...(body.theme as object) })
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('institutions')
      .update(patch)
      .eq('id', inst.id)
      .eq('owner_id', user.id)
      .select('*')
      .single()

    if (error || !updated) {
      console.error('[academy/institutions/[slug]] PATCH error:', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
    return NextResponse.json({ institution: updated })
  } catch (err) {
    console.error('[academy/institutions/[slug]] PATCH error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
