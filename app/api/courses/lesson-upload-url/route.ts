import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mux } from '@/lib/mux'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { lessonId?: string; courseId?: string }
    const { lessonId, courseId } = body

    if (!lessonId || !courseId) {
      return NextResponse.json({ error: 'lessonId and courseId required' }, { status: 400 })
    }

    // Verify creator owns the course
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('creator_id', user.id)
      .single()

    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Verify lesson belongs to the course using direct course_id FK
    const { data: lesson } = await supabase
      .from('course_lessons')
      .select('id, course_id')
      .eq('id', lessonId)
      .eq('course_id', courseId)
      .single()

    if (!lesson) return NextResponse.json({ error: 'Lesson not found in course' }, { status: 404 })

    // Check Mux is configured
    const muxTokenId = process.env.MUX_TOKEN_ID
    if (!muxTokenId || muxTokenId.startsWith('your-') || muxTokenId.length < 10) {
      return NextResponse.json({ error: 'Mux is not configured on this server' }, { status: 503 })
    }

    const upload = await mux.video.uploads.create({
      cors_origin: process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com',
      new_asset_settings: {
        playback_policy: ['public'],
        mp4_support: 'none',
      },
    })

    // Store the upload ID on the lesson so we can poll it later
    await supabase.from('course_lessons').update({ mux_asset_id: upload.id }).eq('id', lessonId)

    return NextResponse.json({ uploadUrl: upload.url, assetId: upload.id })
  } catch (err) {
    console.error('[lesson-upload-url] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
