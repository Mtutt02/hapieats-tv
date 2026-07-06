import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { status?: string }
    const validStatuses = ['published', 'draft', 'archived']
    const newStatus = validStatuses.includes(body.status ?? '') ? body.status : null
    if (!newStatus) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

    // Verify creator
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', params.courseId)
      .eq('creator_id', user.id)
      .single()

    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const { error } = await supabase
      .from('courses')
      .update({ status: newStatus })
      .eq('id', params.courseId)

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

    return NextResponse.json({ ok: true, status: newStatus })
  } catch (err) {
    console.error('[courses/publish] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
