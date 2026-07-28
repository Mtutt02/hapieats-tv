import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { classId: string; lessonId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify instructor owns the class
  const { data: cls } = await supabase
    .from('classes')
    .select('instructor_id')
    .eq('id', params.classId)
    .single()
  if (!cls || cls.instructor_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, description, video_id, order_index, is_free_preview } = body

  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (video_id !== undefined) updates.video_id = video_id
  if (order_index !== undefined) updates.order_index = order_index
  if (is_free_preview !== undefined) updates.is_free_preview = is_free_preview

  const { data, error } = await supabase
    .from('class_lessons')
    .update(updates)
    .eq('id', params.lessonId)
    .eq('class_id', params.classId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { classId: string; lessonId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify instructor owns the class
  const { data: cls } = await supabase
    .from('classes')
    .select('instructor_id')
    .eq('id', params.classId)
    .single()
  if (!cls || cls.instructor_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('class_lessons')
    .delete()
    .eq('id', params.lessonId)
    .eq('class_id', params.classId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
