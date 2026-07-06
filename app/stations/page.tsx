import AppShell from '@/components/layout/AppShell'
import Image from 'next/image'
import Link from 'next/link'
import { formatViews } from '@/lib/utils'
import { Users, Video } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'

export const metadata = { title: 'Stations', description: 'Explore themed food communities on HapiEats TV. Join a station or create your own.' }
export const revalidate = 60 // revalidate every 60s

async function getStations() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('stations')
    .select('id, slug, name, description, icon, cover_url, follower_count, video_count')
    .order('follower_count', { ascending: false })
  return data ?? []
}

export default async function StationsPage() {
  const stations = await getStations()

  return (
    <AppShell>
      <div className="px-4 py-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Stations</h1>
          <p className="text-muted-foreground mt-1">
            Themed communities where creators upload and fans discover. Join a station or{' '}
            <Link href="/stations/create" className="text-primary hover:underline">
              start your own
            </Link>
            .
          </p>
        </div>

        {/* Featured — first station */}
        {stations.length > 0 && (
          <section className="mb-10">
            <Link href={`/stations/${stations[0].slug}`} className="group block">
              <div className="relative w-full h-52 rounded-2xl overflow-hidden">
                <Image
                  src={stations[0].cover_url ?? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'}
                  alt={stations[0].name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 1000px"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
                <div className="absolute inset-0 flex items-end p-6">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary mb-1 block">
                      Featured Station
                    </span>
                    <h2 className="text-3xl font-bold mb-1">
                      {stations[0].icon} {stations[0].name}
                    </h2>
                    <p className="text-muted-foreground text-sm mb-3 max-w-md">
                      {stations[0].description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {formatViews(stations[0].follower_count)} followers
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="h-3.5 w-3.5" />
                        {stations[0].video_count} videos
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* All Stations grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {stations.map((station) => (
            <Link
              key={station.id}
              href={`/stations/${station.slug}`}
              className="group block rounded-2xl overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors"
            >
              {/* Cover */}
              <div className="relative w-full h-32 bg-muted">
                <Image
                  src={station.cover_url ?? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'}
                  alt={station.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <div className="absolute inset-0 station-gradient" />
                <span className="absolute bottom-2 left-3 text-2xl">{station.icon}</span>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">
                  {station.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {station.description}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {formatViews(station.follower_count)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Video className="h-3 w-3" />
                    {station.video_count} videos
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {/* Create your own CTA */}
          <Link
            href="/stations/create"
            className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border hover:border-primary/60 bg-transparent text-center p-8 transition-colors min-h-[200px]"
          >
            <span className="text-3xl mb-3">📡</span>
            <p className="font-semibold text-sm text-muted-foreground group-hover:text-primary transition-colors">
              Create a Station
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Build your own themed community
            </p>
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
