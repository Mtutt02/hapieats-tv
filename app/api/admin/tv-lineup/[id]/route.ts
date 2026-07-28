import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'superadmin'].includes(profile.role ?? '')) return null
  return user
}

// PATCH /api/admin/tv-lineup/[id] — update a slot
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const service = createServiceClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.channel_number !== undefined) updates.channel_number = Number(body.channel_number)
  if (body.name          !== undefined) updates.name           = body.name.trim()
  if (body.icon          !== undefined) updates.icon           = body.icon.trim() || '📺'
  if (body.description   !== undefined) updates.description    = body.description.trim()
  if (body.category      !== undefined) updates.category       = body.category.trim()
  if (body.channel_id    !== undefined) updates.channel_id     = body.channel_id || null
  if (body.mux_playback_id !== undefined) updates.mux_playback_id = body.mux_playback_id?.trim() || null
  if (body.video_url     !== undefined) updates.video_url      = body.video_url?.trim() || null
  if (body.is_active     !== undefined) updates.is_active      = !!body.is_active

  const { data, error } = await service
    .from('tv_lineup')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That channel number is already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ slot: data })
}

// DELETE /api/admin/tv-lineup/[id] — remove a slot
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { error } = await service.from('tv_lineup').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
