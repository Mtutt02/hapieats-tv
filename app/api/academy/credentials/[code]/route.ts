import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — PUBLIC verification of a credential by its verification_code.
// Returns validity + holder + title + tier + issuer + date. No auth required.
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  try {
    const code = (params.code ?? '').trim()
    if (!code) return NextResponse.json({ valid: false, error: 'Missing code' }, { status: 400 })

    // Service client → credentials are public-verifiable regardless of session.
    const svc = createServiceClient()

    const { data: credential } = await svc
      .from('credentials')
      .select('id, user_id, course_id, program_id, institution_id, tier, title, serial, accreditation_partner, issued_at, revoked')
      .eq('verification_code', code)
      .maybeSingle()

    if (!credential) {
      return NextResponse.json({ valid: false, error: 'Credential not found' }, { status: 404 })
    }

    // Holder name (public-facing).
    const { data: holder } = await svc
      .from('profiles')
      .select('display_name, username')
      .eq('id', credential.user_id)
      .maybeSingle()

    // Issuer — institution name if present, else the course creator's channel.
    let issuer: string | null = credential.accreditation_partner
    if (credential.institution_id) {
      const { data: inst } = await svc
        .from('institutions')
        .select('name')
        .eq('id', credential.institution_id)
        .maybeSingle()
      if (inst?.name) issuer = inst.name
    }
    if (!issuer) issuer = 'HapiEats Academy'

    return NextResponse.json({
      valid: !credential.revoked,
      revoked: credential.revoked,
      holder: holder?.display_name || holder?.username || 'HapiEats Learner',
      title: credential.title,
      tier: credential.tier,
      serial: credential.serial,
      issuer,
      accreditationPartner: credential.accreditation_partner,
      issuedAt: credential.issued_at,
    })
  } catch (err) {
    console.error('[academy/credentials/[code] GET] Error:', err)
    return NextResponse.json({ valid: false, error: 'Something went wrong' }, { status: 500 })
  }
}
