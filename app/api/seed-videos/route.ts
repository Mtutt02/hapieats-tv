import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const VIDEOS = [
  { title: '🔥 Smash Burger with Wagyu Beef', mux_playback_id: 'bP6XRc6Nf502myJ7IxpwADy01n02bWiTZ7T00vQNuDS00s', duration: 424, view_count: 54200 },
  { title: '🍣 Sushi Rice Master Class', mux_playback_id: '7q02i00O009a9RXHRLI00GfT0202I1V02j3dQqivw023QVkI', duration: 612, view_count: 31700 },
  { title: '🌮 Mexico City Street Tacos', mux_playback_id: 'Xh01R02U02W00Ck01o02Gu6V02O0233yXCqN01BB8gKtLf00', duration: 540, view_count: 92100 },
  { title: '🍝 Cacio e Pepe the Roman Way', mux_playback_id: '00eH01aYWuI00fWGQJLbhC02WEzDejwP5I02PRIg5Wx100Q', duration: 380, view_count: 61300 },
  { title: '🥐 Croissant Lamination Technique', mux_playback_id: '6HC018a00zQhGU00V01a00pp1M02hJFC02q1FGB02IPx01m8', duration: 720, view_count: 37900 },
  { title: '🍕 Neapolitan Pizza in Home Oven', mux_playback_id: 'RW36MAKL001Y024k2fP008601Rfk02l02Hc02WIaBbZxOIc', duration: 490, view_count: 79200 },
]

export async function POST() {
  const supabase = createServiceClient()
  const { data: channel } = await supabase.from('channels').select('id, creator_id').limit(1).single()
  if (!channel) return NextResponse.json({ error: 'No channel' }, { status: 400 })

  const ids = []
  for (const v of VIDEOS) {
    const { data: existing } = await supabase.from('videos').select('id').eq('mux_playback_id', v.mux_playback_id).maybeSingle()
    if (existing) { ids.push({ title: v.title, status: 'exists', id: existing.id }); continue }
    const { data: created } = await supabase.from('videos').insert({
      channel_id: channel.id, creator_id: channel.creator_id,
      title: v.title, description: '', mux_playback_id: v.mux_playback_id,
      duration: v.duration, thumbnail_url: `https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg?time=30`,
      pricing_model: 'free', visibility: 'public', status: 'ready',
      view_count: v.view_count, published_at: new Date().toISOString(),
    }).select('id, title').single()
    if (created) ids.push({ title: created.title, status: 'inserted', id: created.id })
  }
  return NextResponse.json({ results: ids })
}
