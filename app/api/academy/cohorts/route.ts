import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { video } from '@/lib/mux'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const COHORT_COLS =
  'id, course_id, title, starts_at, ends_at, capacity, live_stream_id, status, created_at'

// GET /api/academy/cohorts?courseId=... — upcoming (+ live) cohorts for a course.
export async function GET(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get('courseId')
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    const service = createServiceClient()
    const nowIso = new Date().toISOString()

    // "Upcoming" = scheduled/live and either no end time yet or ending in the future.
    const { data, error } = await service
      .from('cohorts')
      .select(COHORT_COLS)
      .eq('course_id', courseId)
      .in('status', ['scheduled', 'live'])
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('starts_at', { ascending: true })

    if (error) {
      console.error('[academy/cohorts GET] DB error:', error)
      return NextResponse.json({ error: 'Failed to load cohorts' }, { status: 500 })
    }

    return NextResponse.json({ cohorts: data ?? [] })
  } catch (err) {
    console.error('[academy/cohorts GET] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST /api/academy/cohorts — course owner schedules a cohort (optionally with a Mux live stream).
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      course_id?: string
      title?: string
      starts_at?: string
      ends_at?: string | null
      capacity?: number | null
      create_stream?: boolean
    }

    const courseId = typeof body.course_id === 'string' ? body.course_id : ''
    if (!courseId) return NextResponse.json({ error: 'course_id is required' }, { status: 400 })

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (title.length < 3 || title.length > 120) {
      return NextResponse.json({ error: 'Title must be 3–120 characters' }, { status: 400 })
    }

    const startsAt = body.starts_at ? new Date(body.starts_at) : null
    if (!startsAt || isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: 'A valid start date/time is required' }, { status: 400 })
    }
    let endsAt: Date | null = null
    if (body.ends_at) {
      endsAt = new Date(body.ends_at)
      if (isNaN(endsAt.getTime())) {
        return NextResponse.json({ error: 'Invalid end date/time' }, { status: 400 })
      }
      if (endsAt <= startsAt) {
        return NextResponse.json({ error: 'End time must be after the start time' }, { status: 400 })
      }
    }

    let capacity: number | null = null
    if (body.capacity != null) {
      const c = Math.round(Number(body.capacity))
      if (isNaN(c) || c < 1) return NextResponse.json({ error: 'Capacity must be at least 1' }, { status: 400 })
      capacity = c
    }

    const service = createServiceClient()

    // Ownership gate — only the course creator may schedule a cohort for it.
    const { data: course } = await service
      .from('courses')
      .select('id, creator_id')
      .eq('id', courseId)
      .single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (course.creator_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Optionally spin up a Mux live stream (reuses the livestreams/create pattern).
    let liveStreamId: string | null = null
    if (body.create_stream) {
      const muxId = process.env.MUX_TOKEN_ID ?? ''
      if (!muxId || muxId.startsWith('your-') || muxId.length < 10) {
        return NextResponse.json({
          error: 'Mux is not configured. Add MUX_TOKEN_ID and MUX_TOKEN_SECRET to enable live cohorts.',
          setup: true,
        }, { status: 503 })
      }

      // A live_streams row needs a channel — use the creator's first channel.
      const { data: channel } = await service
        .from('channels')
        .select('id')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!channel) {
        return NextResponse.json({
          error: 'You need a channel before scheduling a live cohort. Create one in Creator Studio first.',
        }, { status: 400 })
      }

      const muxStream = await video.liveStreams.create({
        playback_policy: ['public'],
        new_asset_settings: { playback_policy: ['public'] },
        latency_mode: 'reduced',
      })

      const { data: ls, error: lsErr } = await service
        .from('live_streams')
        .insert({
          channel_id: channel.id,
          creator_id: user.id,
          title,
          description: `Live cohort: ${title}`,
          mux_live_stream_id: muxStream.id,
          stream_key: muxStream.stream_key,
          mux_playback_id: muxStream.playback_ids?.[0]?.id ?? null,
          status: 'idle',
        })
        .select('id')
        .single()
      if (lsErr || !ls) {
        console.error('[academy/cohorts POST] live_streams insert failed:', lsErr)
        return NextResponse.json({ error: 'Failed to create the live stream' }, { status: 500 })
      }
      liveStreamId = ls.id
    }

    const { data: cohort, error } = await service
      .from('cohorts')
      .insert({
        course_id: courseId,
        title,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        capacity,
        live_stream_id: liveStreamId,
        status: 'scheduled',
      })
      .select(COHORT_COLS)
      .single()

    if (error || !cohort) {
      console.error('[academy/cohorts POST] DB error:', error)
      return NextResponse.json({ error: 'Failed to create cohort' }, { status: 500 })
    }

    return NextResponse.json({ cohort }, { status: 201 })
  } catch (err) {
    console.error('[academy/cohorts POST] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
