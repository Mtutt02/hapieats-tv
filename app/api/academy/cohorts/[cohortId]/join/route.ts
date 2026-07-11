import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/academy/cohorts/[cohortId]/join — join a cohort (capacity-enforced, idempotent).
export async function POST(
  _req: NextRequest,
  { params }: { params: { cohortId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    const { data: cohort } = await service
      .from('cohorts')
      .select('id, capacity, status')
      .eq('id', params.cohortId)
      .single()
    if (!cohort) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 })
    if (cohort.status === 'ended' || cohort.status === 'canceled') {
      return NextResponse.json({ error: 'This cohort is closed' }, { status: 409 })
    }

    // Already a member? Idempotent success.
    const { data: existing } = await service
      .from('cohort_members')
      .select('user_id')
      .eq('cohort_id', params.cohortId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, joined: true, already: true })
    }

    // Capacity check (best-effort; the unique PK guards against duplicate rows).
    if (cohort.capacity != null) {
      const { count } = await service
        .from('cohort_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('cohort_id', params.cohortId)
      if ((count ?? 0) >= cohort.capacity) {
        return NextResponse.json({ error: 'This cohort is full' }, { status: 409 })
      }
    }

    const { error } = await service
      .from('cohort_members')
      .insert({ cohort_id: params.cohortId, user_id: user.id })
    // Duplicate key (raced join) is fine — treat as success.
    if (error && !String(error.code).startsWith('23505')) {
      console.error('[academy/cohorts/join POST] DB error:', error)
      return NextResponse.json({ error: 'Failed to join cohort' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, joined: true })
  } catch (err) {
    console.error('[academy/cohorts/join POST] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE /api/academy/cohorts/[cohortId]/join — leave a cohort.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { cohortId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { error } = await service
      .from('cohort_members')
      .delete()
      .eq('cohort_id', params.cohortId)
      .eq('user_id', user.id)

    if (error) {
      console.error('[academy/cohorts/join DELETE] DB error:', error)
      return NextResponse.json({ error: 'Failed to leave cohort' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, joined: false })
  } catch (err) {
    console.error('[academy/cohorts/join DELETE] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
