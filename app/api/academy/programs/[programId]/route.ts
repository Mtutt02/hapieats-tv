import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { CredentialTier } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

const TIERS = new Set<CredentialTier>(['completion', 'skill', 'diploma'])

// GET — program + ordered course summaries + caller's enrollment/progress
export async function GET(_req: NextRequest, { params }: { params: { programId: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: program, error } = await supabase
      .from('programs')
      .select('*')
      .eq('id', params.programId)
      .single()

    if (error || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Ordered program_courses → course summaries.
    const { data: links } = await supabase
      .from('program_courses')
      .select('course_id, order_index, required')
      .eq('program_id', program.id)
      .order('order_index', { ascending: true })

    const courseIds = (links ?? []).map((l) => l.course_id)
    let courses: any[] = []
    if (courseIds.length) {
      const { data: cs } = await supabase
        .from('courses')
        .select('id, title, description, category, level, thumbnail_url, estimated_minutes, price_usd, price')
        .in('id', courseIds)
      const byId = new Map((cs ?? []).map((c) => [c.id, c]))
      courses = (links ?? []).map((l) => ({
        ...(byId.get(l.course_id) ?? { id: l.course_id }),
        order_index: l.order_index,
        required: l.required,
      }))
    }

    // Progress: is the caller enrolled?
    let enrollment: any = null
    if (user) {
      const { data: enr } = await supabase
        .from('program_enrollments')
        .select('id, status, completed_at, created_at')
        .eq('program_id', program.id)
        .eq('user_id', user.id)
        .maybeSingle()
      enrollment = enr ?? null
    }

    return NextResponse.json({
      program,
      courses,
      isOwner: !!user && user.id === program.owner_id,
      enrollment,
    })
  } catch (err) {
    console.error('[academy/programs/[id]] GET error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH — owner-only. Update fields, publish, and manage program_courses.
export async function PATCH(req: NextRequest, { params }: { params: { programId: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: program } = await supabase
      .from('programs')
      .select('id, owner_id')
      .eq('id', params.programId)
      .single()

    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    if (program.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only the owner can edit this program' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({})) as {
      title?: string
      description?: string | null
      credential_tier?: string
      price?: number
      is_published?: boolean
      courseIds?: string[] // ordered set → replaces program_courses
    }

    const patch: Record<string, unknown> = {}
    if (typeof body.title === 'string') {
      const t = body.title.trim()
      if (t.length < 3) return NextResponse.json({ error: 'Title too short' }, { status: 400 })
      patch.title = t.slice(0, 120)
    }
    if (typeof body.description === 'string') patch.description = body.description.trim() || null
    if (TIERS.has(body.credential_tier as CredentialTier)) patch.credential_tier = body.credential_tier
    if (typeof body.price === 'number' && body.price >= 0) patch.price = Math.round(body.price * 100) / 100
    if (typeof body.is_published === 'boolean') patch.is_published = body.is_published

    if (Object.keys(patch).length) {
      const { error } = await supabase.from('programs').update(patch).eq('id', program.id).eq('owner_id', user.id)
      if (error) {
        console.error('[academy/programs/[id]] update error:', error)
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
      }
    }

    // Reorder / replace program_courses when an ordered list is provided.
    if (Array.isArray(body.courseIds)) {
      const ids = body.courseIds.filter((x) => typeof x === 'string' && x).slice(0, 60)
      const service = createServiceClient()
      await service.from('program_courses').delete().eq('program_id', program.id)
      if (ids.length) {
        const rows = ids.map((course_id, i) => ({
          program_id: program.id,
          course_id,
          order_index: i,
          required: true,
        }))
        const { error: insErr } = await service.from('program_courses').insert(rows)
        if (insErr) {
          console.error('[academy/programs/[id]] program_courses insert error:', insErr)
          return NextResponse.json({ error: 'Failed to update curriculum' }, { status: 500 })
        }
      }
    }

    const { data: updated } = await supabase.from('programs').select('*').eq('id', program.id).single()
    return NextResponse.json({ program: updated })
  } catch (err) {
    console.error('[academy/programs/[id]] PATCH error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
