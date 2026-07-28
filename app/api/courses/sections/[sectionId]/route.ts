import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Auth helper — verify the user owns the section's course
async function verifySectionOwner(supabase: ReturnType<typeof createClient>, userId: string, sectionId: string) {
  const { data } = await supabase
    .from('course_sections')
    .select('id, course:courses!inner(creator_id)')
    .eq('id', sectionId)
    .single()

  if (!data) return false
  const course = data.course as { creator_id: string } | null
  return course?.creator_id === userId
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { sectionId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const owns = await verifySectionOwner(supabase, user.id, params.sectionId)
    if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json().catch(() => ({})) as { title?: string; position?: number }
    const updates: Record<string, unknown> = {}
    if (body.title?.trim()) updates.title = body.title.trim()
    if (typeof body.position === 'number') updates.position = body.position

    if (!Object.keys(updates).length) return NextResponse.json({ ok: true })

    const { error } = await supabase.from('course_sections').update(updates).eq('id', params.sectionId)
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[sections/PATCH] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { sectionId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const owns = await verifySectionOwner(supabase, user.id, params.sectionId)
    if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Cascade delete lessons first (RLS should handle this, but be explicit)
    await supabase.from('course_lessons').delete().eq('section_id', params.sectionId)
    const { error } = await supabase.from('course_sections').delete().eq('id', params.sectionId)
    if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[sections/DELETE] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
