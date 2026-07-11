import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  COURSE_CATEGORIES,
  type CourseFormat,
  type CourseLevel,
  type PricingModel,
  type CredentialTier,
} from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

const FORMATS: CourseFormat[] = ['recorded', 'live', 'hybrid']
const LEVELS: CourseLevel[] = ['beginner', 'intermediate', 'advanced', 'professional']
const PRICING: PricingModel[] = ['free', 'paid', 'pro_only']
const TIERS: CredentialTier[] = ['completion', 'skill', 'diploma']

// GET /api/academy/courses — list the caller's own courses
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('courses')
      .select('id, creator_id, title, description, category, format, level, pricing_model, price, pro_included, issues_certificate, certificate_tier, requires_assessment, institution_id, estimated_minutes, enrollment_count, is_published, created_at')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[academy/courses GET] DB error:', error)
      return NextResponse.json({ error: 'Failed to load courses' }, { status: 500 })
    }

    return NextResponse.json({ courses: data ?? [] })
  } catch (err) {
    console.error('[academy/courses GET] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST /api/academy/courses — create a course owned by the caller
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      title?: string
      description?: string | null
      category?: string
      format?: string
      level?: string
      pricing_model?: string
      price?: number
      pro_included?: boolean
      certificate_tier?: string
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (title.length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }
    if (title.length > 120) {
      return NextResponse.json({ error: 'Title too long (max 120)' }, { status: 400 })
    }

    const format: CourseFormat = FORMATS.includes(body.format as CourseFormat) ? body.format as CourseFormat : 'recorded'
    const level: CourseLevel = LEVELS.includes(body.level as CourseLevel) ? body.level as CourseLevel : 'beginner'
    const pricing_model: PricingModel = PRICING.includes(body.pricing_model as PricingModel) ? body.pricing_model as PricingModel : 'free'
    const certificate_tier: CredentialTier = TIERS.includes(body.certificate_tier as CredentialTier) ? body.certificate_tier as CredentialTier : 'completion'
    const category = typeof body.category === 'string' && body.category.trim()
      ? body.category.trim()
      : COURSE_CATEGORIES[COURSE_CATEGORIES.length - 1] // 'general'

    let price = 0
    if (pricing_model === 'paid') {
      const raw = typeof body.price === 'number' ? body.price : parseFloat(String(body.price ?? 0))
      if (isNaN(raw) || raw < 1) {
        return NextResponse.json({ error: 'Paid courses need a price of at least $1' }, { status: 400 })
      }
      price = Math.round(raw * 100) / 100
    }

    const pro_included = pricing_model === 'pro_only' ? true : body.pro_included === true

    // Ownership is implicit: creator_id = the authenticated user.
    const service = createServiceClient()
    const { data: course, error } = await service
      .from('courses')
      .insert({
        creator_id: user.id,
        title,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        category,
        format,
        level,
        pricing_model,
        price,
        pro_included,
        certificate_tier,
        is_published: false,
        enrollment_count: 0,
      })
      .select('id, creator_id, title, description, category, format, level, pricing_model, price, pro_included, issues_certificate, certificate_tier, requires_assessment, institution_id, estimated_minutes, enrollment_count, is_published, created_at')
      .single()

    if (error || !course) {
      console.error('[academy/courses POST] DB error:', error)
      return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
    }

    return NextResponse.json({ course }, { status: 201 })
  } catch (err) {
    console.error('[academy/courses POST] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
