import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      title?: string
      description?: string | null
      category?: string | null
      level?: string
      pricingModel?: string
      priceUsd?: number
      whatYouLearn?: string[]
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length < 3) {
      return NextResponse.json({ error: 'Course title must be at least 3 characters' }, { status: 400 })
    }
    if (title.length > 120) {
      return NextResponse.json({ error: 'Title too long (max 120 characters)' }, { status: 400 })
    }

    const pricingModel = body.pricingModel === 'paid' ? 'paid' : 'free'
    let priceUsd: number | null = null
    if (pricingModel === 'paid') {
      priceUsd = typeof body.priceUsd === 'number' ? body.priceUsd : parseFloat(String(body.priceUsd ?? 0))
      if (isNaN(priceUsd) || priceUsd < 1) {
        return NextResponse.json({ error: 'Price must be at least $1.00' }, { status: 400 })
      }
      priceUsd = Math.round(priceUsd * 100) / 100 // 2dp
    }

    const validLevels = ['beginner', 'intermediate', 'advanced', 'all_levels']
    const level = validLevels.includes(body.level ?? '') ? body.level : 'beginner'

    const whatYouLearn = Array.isArray(body.whatYouLearn)
      ? body.whatYouLearn.filter((s) => typeof s === 'string' && s.trim()).slice(0, 8)
      : []

    const { data: course, error } = await supabase
      .from('courses')
      .insert({
        creator_id: user.id,
        title,
        description: body.description?.trim() || null,
        category: body.category || null,
        level,
        pricing_model: pricingModel,
        price_usd: priceUsd,
        what_you_learn: whatYouLearn.length ? whatYouLearn : null,
        status: 'draft',
        enrollment_count: 0,
        lesson_count: 0,
      })
      .select('id')
      .single()

    if (error || !course) {
      console.error('[courses/create] DB error:', error)
      return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
    }

    return NextResponse.json({ courseId: course.id })
  } catch (err) {
    console.error('[courses/create] Error:', err)
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 })
  }
}
