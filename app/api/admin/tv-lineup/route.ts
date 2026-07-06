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

// GET /api/admin/tv-lineup — list all lineup slots
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('tv_lineup')
    .select(`
      id, channel_number, name, icon, description, category,
      mux_playback_id, video_url, is_active, created_at,
      channel:channel_id (id, name, slug, thumbnail_url)
    `)
    .order('channel_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lineup: data })
}

// POST /api/admin/tv-lineup — create a new lineup slot
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { channel_number, name, icon, description, category, channel_id, mux_playback_id, video_url } = body

  if (!channel_number || !name) {
    return NextResponse.json({ error: 'channel_number and name are required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('tv_lineup')
    .insert({
      channel_number: Number(channel_number),
      name: name.trim(),
      icon: icon?.trim() || '📺',
      description: description?.trim() || '',
      category: category?.trim() || 'General',
      channel_id: channel_id || null,
      mux_playback_id: mux_playback_id?.trim() || null,
      video_url: video_url?.trim() || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Channel ${channel_number} already exists in the lineup` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ slot: data }, { status: 201 })
}
