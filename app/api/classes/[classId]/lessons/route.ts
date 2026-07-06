import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: { classId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is enrolled or is the instructor
  let hasFullAccess = false
  if (user) {
    const { data: cls } = await supabase
      .from('classes').select('instructor_id').eq('id', params.classId).single()
    if (cls?.instructor_id === user.id) hasFullAccess = true

    if (!hasFullAccess) {
      const { data: enrollment } = await supabase
        .from('class_enrollments').select('id')
        .eq('class_id', params.classId).eq('user_id', user.id).eq('status', 'active').single()
      hasFullAccess = !!enrollment
    }
  }

  let query = supabase
    .from('class_lessons')
    .select('*, video:videos(id, mux_playback_id, duration, title)')
    .eq('class_id', params.classId)
    .order('order_index', { ascending: true })

  if (!hasFullAccess) query = query.eq('is_free_preview', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lessons: data, hasFullAccess })
}

export async function POST(req: NextRequest, { params }: { params: { classId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify instructor
  const { data: cls } = await supabase
    .from('classes').select('instructor_id').eq('id', params.classId).single()
  if (!cls || cls.instructor_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, video_id, order_index, is_free_preview, description } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('class_lessons')
    .insert({ class_id: params.classId, title, video_id, order_index: order_index ?? 0, is_free_preview: is_free_preview ?? false, description })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
