import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('token_balances')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ balance: data?.balance ?? 0 })
}
