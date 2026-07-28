import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: { classId: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('classes')
    .select(`
      *,
      instructor:profiles(id, username, display_name, avatar_url, bio),
      channel:channels(id, name, slug, subscriber_count),
      lessons:class_lessons(*, video:videos(id, mux_playback_id, duration))
    `)
    .eq('id', params.classId)
    .order('order_index', { referencedTable: 'class_lessons', ascending: true })
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check if user is enrolled
  const { data: { user } } = await supabase.auth.getUser()
  let isEnrolled = false
  if (user) {
    const { data: enrollment } = await supabase
      .from('class_enrollments')
      .select('id')
      .eq('class_id', params.classId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()
    isEnrolled = !!enrollment
  }

  return NextResponse.json({ ...data, isEnrolled })
}

export async function PATCH(req: NextRequest, { params }: { params: { classId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, category, skill_level, type, price, scheduled_at, thumbnail_url, is_published } = body

  // Verify ownership
  const { data: cls } = await supabase
    .from('classes')
    .select('instructor_id')
    .eq('id', params.classId)
    .single()
  if (!cls || cls.instructor_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (category !== undefined) updates.category = category
  if (skill_level !== undefined) updates.skill_level = skill_level
  if (type !== undefined) updates.type = type
  if (price !== undefined) updates.price = price
  if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at
  if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url
  if (is_published !== undefined) updates.is_published = is_published

  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', params.classId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
