import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Radio } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Live',
  description: 'Watch live food streams happening right now on HapiEats TV.',
}

export default async function LiveBrowsePage() {
  const supabase = createClient()
  const { data: streams } = await supabase
    .from('live_streams')
    .select('id, title, description, status, mux_playback_id, created_at, channel:channels(id, name, slug, thumbnail_url), creator:profiles(username, display_name, avatar_url)')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(20)

  const activeStreams = streams ?? []

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-red-500" />
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Live Now</h1>
            <p className="text-sm text-muted-foreground">
              {activeStreams.length > 0 ? `${activeStreams.length} stream${activeStreams.length !== 1 ? 's' : ''} live` : 'No streams live right now'}
            </p>
          </div>
        </div>

        {activeStreams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeStreams.map(s => (
              <Link key={s.id} href={`/live/${s.id}`} className="block group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors">
                <div className="aspect-video bg-muted relative flex items-center justify-center">
                  {(s as any).mux_playback_id ? (
                    <img
                      src={`https://image.mux.com/${(s as any).mux_playback_id}/thumbnail.jpg?width=640&fit_mode=preserve`}
                      alt={s.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-4xl">📡</div>
                  )}
                  <span className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>
                </div>
                <div className="p-4">
                  <div className="font-medium text-sm line-clamp-2">{s.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{(s.channel as any)?.name}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <div className="text-5xl mb-4">📡</div>
            <p className="text-lg font-medium mb-2">No streams live right now</p>
            <p className="text-sm">Check back later, or start your own stream.</p>
            <Link
              href="/studio/go-live"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition"
            >
              Go Live
            </Link>
          </div>
        )}
      </main>
    </AppShell>
  )
}
