import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Analytics', description: 'Platform analytics for HapiEats TV.' }

export default async function AdminAnalyticsPage() {
  const supabase = createClient()

  const [
    { count: totalUsers },
    { count: totalVideos },
    { count: totalCreators },
    { data: topVideos },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_creator', true),
    supabase.from('videos')
      .select('id, title, view_count, like_count, channel:channels(name)')
      .eq('status', 'ready')
      .order('view_count', { ascending: false })
      .limit(10),
  ])

  const stats = [
    { label: 'Total Users', value: totalUsers ?? 0 },
    { label: 'Total Creators', value: totalCreators ?? 0 },
    { label: 'Published Videos', value: totalVideos ?? 0 },
    { label: 'Creator/User Ratio', value: totalUsers ? `${Math.round(((totalCreators ?? 0) / totalUsers) * 100)}%` : '—' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Platform-wide metrics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Top Videos by Views</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left pb-3 font-medium text-muted-foreground">#</th>
              <th className="text-left pb-3 font-medium text-muted-foreground">Title</th>
              <th className="text-left pb-3 font-medium text-muted-foreground">Channel</th>
              <th className="text-right pb-3 font-medium text-muted-foreground">Views</th>
              <th className="text-right pb-3 font-medium text-muted-foreground">Likes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(topVideos ?? []).map((v, i) => (
              <tr key={v.id} className="hover:bg-muted/20">
                <td className="py-3 text-muted-foreground">{i + 1}</td>
                <td className="py-3 font-medium truncate max-w-[200px]">{v.title}</td>
                <td className="py-3 text-muted-foreground text-xs">{(v.channel as any)?.name}</td>
                <td className="py-3 text-right">{(v.view_count ?? 0).toLocaleString()}</td>
                <td className="py-3 text-right text-muted-foreground">{(v.like_count ?? 0).toLocaleString()}</td>
              </tr>
            ))}
            {!topVideos?.length && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">No video data yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
