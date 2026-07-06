import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const service = createServiceClient()
  const { data: packs, error } = await service
    .from('token_packs')
    .select('id, name, description, token_amount, bonus_tokens, price_cents, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ packs: packs ?? [] })
}
