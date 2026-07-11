import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CohortStatus = 'scheduled' | 'live' | 'ended' | 'canceled'

// Allowed status transitions for the owner.
const TRANSITIONS: Record<CohortStatus, CohortStatus[]> = {
  scheduled: ['live', 'canceled'],
  live: ['ended'],
  ended: [],
  canceled: [],
}

// GET /api/academy/cohorts/[cohortId] — detail: course, member count, stream playback id, status.
export async function GET(
  _req: NextRequest,
  { params }: { params: { cohortId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const service = createServiceClient()

    const { data: cohort } = await service
      .from('cohorts')
      .select('id, course_id, title, starts_at, ends_at, capacity, live_stream_id, status, created_at')
      .eq('id', params.cohortId)
      .single()
    if (!cohort) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 })

    const { data: course } = await service
      .from('courses')
      .select('id, creator_id, title, category, level')
      .eq('id', cohort.course_id)
      .single()

    const { count: memberCount } = await service
      .from('cohort_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('cohort_id', cohort.id)

    // Stream playback id + status (stream_key intentionally never returned to the client).
    let stream: { mux_playback_id: string | null; status: string } | null = null
    if (cohort.live_stream_id) {
      const { data: ls } = await service
        .from('live_streams')
        .select('mux_playback_id, status')
        .eq('id', cohort.live_stream_id)
        .maybeSingle()
      if (ls) stream = { mux_playback_id: ls.mux_playback_id, status: ls.status }
    }

    const isInstructor = !!user && !!course && course.creator_id === user.id
    let isMember = false
    if (user && !isInstructor) {
      const { data: m } = await service
        .from('cohort_members')
        .select('user_id')
        .eq('cohort_id', cohort.id)
        .eq('user_id', user.id)
        .maybeSingle()
      isMember = !!m
    }

    return NextResponse.json({
      cohort,
      course: course ?? null,
      member_count: memberCount ?? 0,
      stream,
      is_instructor: isInstructor,
      is_member: isMember,
    })
  } catch (err) {
    console.error('[academy/cohorts/:id GET] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH /api/academy/cohorts/[cohortId] — owner advances status (scheduled → live → ended, or cancel).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { cohortId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { status?: string }
    const next = body.status as CohortStatus
    if (!next || !['scheduled', 'live', 'ended', 'canceled'].includes(next)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data: cohort } = await service
      .from('cohorts')
      .select('id, course_id, status')
      .eq('id', params.cohortId)
      .single()
    if (!cohort) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 })

    const { data: course } = await service
      .from('courses')
      .select('creator_id')
      .eq('id', cohort.course_id)
      .single()
    if (!course || course.creator_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const current = cohort.status as CohortStatus
    if (current !== next && !TRANSITIONS[current].includes(next)) {
      return NextResponse.json(
        { error: `Cannot move a cohort from ${current} to ${next}` },
        { status: 409 },
      )
    }

    const { data: updated, error } = await service
      .from('cohorts')
      .update({ status: next })
      .eq('id', params.cohortId)
      .select('id, course_id, title, starts_at, ends_at, capacity, live_stream_id, status, created_at')
      .single()
    if (error || !updated) {
      console.error('[academy/cohorts/:id PATCH] DB error:', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ cohort: updated })
  } catch (err) {
    console.error('[academy/cohorts/:id PATCH] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
