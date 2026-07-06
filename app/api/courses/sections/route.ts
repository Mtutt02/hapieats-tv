import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { courseId?: string; title?: string; position?: number }
    const { courseId, title, position } = body

    if (!courseId || !title?.trim()) {
      return NextResponse.json({ error: 'courseId and title required' }, { status: 400 })
    }

    // Verify creator owns the course
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('creator_id', user.id)
      .single()

    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const { data: section, error } = await supabase
      .from('course_sections')
      .insert({ course_id: courseId, title: title.trim(), position: position ?? 0 })
      .select()
      .single()

    if (error || !section) {
      console.error('[sections] insert error:', error)
      return NextResponse.json({ error: 'Failed to create section' }, { status: 500 })
    }

    return NextResponse.json({ section })
  } catch (err) {
    console.error('[sections] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
