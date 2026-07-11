import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/academy/courses/[courseId]/recipes — public list of all recipes for a course.
export async function GET(
  _req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const service = createServiceClient()
    const { data, error } = await service
      .from('lesson_recipes')
      .select('*')
      .eq('course_id', params.courseId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[academy/course recipes GET] DB error:', error)
      return NextResponse.json({ error: 'Failed to load recipes' }, { status: 500 })
    }

    return NextResponse.json({ recipes: data ?? [] })
  } catch (err) {
    console.error('[academy/course recipes GET] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
