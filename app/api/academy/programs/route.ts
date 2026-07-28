import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CredentialTier } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

const TIERS = new Set<CredentialTier>(['completion', 'skill', 'diploma'])

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// GET — the caller's programs
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[academy/programs] GET error:', error)
      return NextResponse.json({ error: 'Failed to load programs' }, { status: 500 })
    }
    return NextResponse.json({ programs: data ?? [] })
  } catch (err) {
    console.error('[academy/programs] GET error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST — create a program (owner = caller)
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in to create a program' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      title?: string
      description?: string | null
      credential_tier?: string
      price?: number
      institution_id?: string | null
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (title.length < 3 || title.length > 120) {
      return NextResponse.json({ error: 'Title must be 3–120 characters' }, { status: 400 })
    }

    const credential_tier = TIERS.has(body.credential_tier as CredentialTier)
      ? (body.credential_tier as CredentialTier)
      : 'skill'

    let price = typeof body.price === 'number' ? body.price : parseFloat(String(body.price ?? 0))
    if (isNaN(price) || price < 0) price = 0
    price = Math.round(price * 100) / 100

    // If tied to an institution, the caller must own it.
    let institution_id: string | null = null
    if (typeof body.institution_id === 'string' && body.institution_id.trim()) {
      const { data: inst } = await supabase
        .from('institutions')
        .select('id, owner_id')
        .eq('id', body.institution_id.trim())
        .single()
      if (!inst) return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
      if (inst.owner_id !== user.id) {
        return NextResponse.json({ error: 'You do not own that institution' }, { status: 403 })
      }
      institution_id = inst.id
    }

    const { data: program, error } = await supabase
      .from('programs')
      .insert({
        owner_id: user.id,
        institution_id,
        title,
        slug: slugify(title),
        description: body.description?.toString().trim() || null,
        credential_tier,
        price,
        is_published: false,
      })
      .select('*')
      .single()

    if (error || !program) {
      console.error('[academy/programs] POST error:', error)
      return NextResponse.json({ error: 'Failed to create program' }, { status: 500 })
    }
    return NextResponse.json({ program })
  } catch (err) {
    console.error('[academy/programs] POST error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
