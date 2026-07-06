import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: { stationId: string }
}

// GET — check if current user follows this station
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ following: false })

  const { data } = await supabase
    .from('station_followers')
    .select('station_id')
    .eq('station_id', params.stationId)
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ following: !!data })
}

// POST — follow
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('station_followers')
    .upsert({ station_id: params.stationId, user_id: user.id }, { onConflict: 'station_id,user_id' })

  return NextResponse.json({ ok: true })
}

// DELETE — unfollow
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('station_followers')
    .delete()
    .eq('station_id', params.stationId)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
