import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CREDENTIAL_TYPES = [
  'culinary_school',
  'professional_cook',
  'restaurant_owner',
  'food_blogger',
  'certified_nutritionist',
  'other',
] as const

type CredentialType = (typeof CREDENTIAL_TYPES)[number]

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await (await supabase).auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check creator eligibility
  const { data: profile } = await (await supabase)
    .from('profiles')
    .select('is_creator')
    .eq('id', user.id)
    .single()

  // Check if they have at least 1 video uploaded
  const { count: videoCount } = await (await supabase)
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', user.id)

  if (!profile?.is_creator && (!videoCount || videoCount < 1)) {
    return NextResponse.json(
      { error: 'You must be a creator with at least one video to apply for chef verification.' },
      { status: 403 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { credential_type, credential_detail, portfolio_url, social_proof, additional_notes } = body

  // Validate credential_type
  if (!credential_type || !CREDENTIAL_TYPES.includes(credential_type as CredentialType)) {
    return NextResponse.json(
      { error: `credential_type must be one of: ${CREDENTIAL_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  // Validate credential_detail
  if (!credential_detail || typeof credential_detail !== 'string' || credential_detail.trim().length === 0) {
    return NextResponse.json({ error: 'credential_detail is required' }, { status: 400 })
  }

  if (credential_detail.length > 500) {
    return NextResponse.json({ error: 'credential_detail must be 500 characters or fewer' }, { status: 400 })
  }

  const { data, error } = await (await supabase)
    .from('chef_verification_applications')
    .insert({
      user_id: user.id,
      credential_type,
      credential_detail: credential_detail.trim(),
      portfolio_url: portfolio_url || null,
      social_proof: social_proof || null,
      additional_notes: additional_notes || null,
    })
    .select()
    .single()

  if (error) {
    // Unique constraint: user already applied
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You already have a pending or existing application. Contact support to appeal a denial.' },
        { status: 409 }
      )
    }
    console.error('chef_verification apply error:', error)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }

  return NextResponse.json({ application: data }, { status: 201 })
}
