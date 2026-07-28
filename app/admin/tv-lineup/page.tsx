import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import TVLineupClient from './TVLineupClient'

export const metadata: Metadata = { title: 'TV Lineup — Admin' }
export const dynamic = 'force-dynamic'

export default async function TVLineupPage() {
  const service = createServiceClient()

  const [{ data: lineup }, { data: channels }] = await Promise.all([
    service
      .from('tv_lineup')
      .select(`
        id, channel_number, name, icon, description, category,
        mux_playback_id, video_url, is_active,
        channel:channel_id (id, name, slug)
      `)
      .order('channel_number', { ascending: true }),
    service
      .from('channels')
      .select('id, name, slug')
      .order('name', { ascending: true }),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">TV Lineup</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Assign fixed channel numbers so viewers can type CH 06 or CH 13 on the remote and land on the right content.
        </p>
      </div>
      <TVLineupClient lineup={lineup ?? []} channels={channels ?? []} />
    </div>
  )
}
