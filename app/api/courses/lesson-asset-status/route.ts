import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mux } from '@/lib/mux'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const lessonId = req.nextUrl.searchParams.get('lessonId')
    if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

    // Fetch lesson using direct course_id FK (simpler, no join)
    const { data: lesson } = await supabase
      .from('course_lessons')
      .select('id, mux_asset_id, mux_playback_id, course_id')
      .eq('id', lessonId)
      .single()

    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    // Verify creator owns the course
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', lesson.course_id)
      .eq('creator_id', user.id)
      .single()

    if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Already has playback ID — done
    if (lesson.mux_playback_id) {
      return NextResponse.json({ ready: true, playbackId: lesson.mux_playback_id })
    }

    if (!lesson.mux_asset_id) {
      return NextResponse.json({ ready: false })
    }

    // Check Mux is configured
    const muxTokenId = process.env.MUX_TOKEN_ID
    if (!muxTokenId || muxTokenId.startsWith('your-') || muxTokenId.length < 10) {
      return NextResponse.json({ ready: false })
    }

    try {
      // mux_asset_id on the lesson stores the upload ID at creation time
      const upload = await mux.video.uploads.retrieve(lesson.mux_asset_id)
      if (!upload.asset_id) return NextResponse.json({ ready: false })

      const asset = await mux.video.assets.retrieve(upload.asset_id)

      if (asset.status === 'ready' && asset.playback_ids?.[0]?.id) {
        const playbackId = asset.playback_ids[0].id

        // Persist to DB so subsequent calls return immediately
        await supabase.from('course_lessons').update({
          mux_playback_id: playbackId,
          mux_asset_id: asset.id, // update to real asset ID
        }).eq('id', lessonId)

        return NextResponse.json({ ready: true, playbackId })
      }

      return NextResponse.json({ ready: false, muxStatus: asset.status })
    } catch {
      return NextResponse.json({ ready: false })
    }
  } catch (err) {
    console.error('[lesson-asset-status] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
