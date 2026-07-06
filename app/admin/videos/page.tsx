import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AdminVideoActions from '@/components/admin/AdminVideoActions'

export const metadata: Metadata = { title: 'Videos', description: 'Manage all videos on HapiEats TV.' }

export default async function AdminVideosPage() {
  const supabase = createClient()

  const { data: videos } = await supabase
    .from('videos')
    .select('id, title, status, visibility, is_flagged, flagged_reason, view_count, created_at, channel:channels(name), creator:profiles(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Video Moderation</h1>
        <p className="text-muted-foreground mt-1">{videos?.length ?? 0} videos</p>
      </div>

      {/* Flagged alert */}
      {(videos ?? []).some(v => v.is_flagged) && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          ⚠ {(videos ?? []).filter(v => v.is_flagged).length} flagged video(s) require review
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Creator</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Views</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Added</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(videos ?? []).map(v => (
              <tr key={v.id} className={`hover:bg-muted/20 transition-colors ${v.is_flagged ? 'bg-red-500/5' : ''}`}>
                <td className="px-4 py-3">
                  <div className="font-medium truncate max-w-[220px]">{v.title}</div>
                  <div className="text-xs text-muted-foreground">{(v.channel as any)?.name}</div>
                  {v.is_flagged && (
                    <div className="text-xs text-red-400 mt-0.5">🚩 {v.flagged_reason || 'Flagged'}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {(v.creator as any)?.display_name || (v.creator as any)?.username}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    v.is_flagged ? 'bg-red-500/10 text-red-400' :
                    v.status === 'ready' ? 'bg-green-500/10 text-green-400' :
                    v.visibility === 'private' ? 'bg-muted text-muted-foreground' :
                    'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {v.is_flagged ? 'Flagged' : v.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {(v.view_count ?? 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(v.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <AdminVideoActions videoId={v.id} isFlagged={v.is_flagged} visibility={v.visibility} />
                </td>
              </tr>
            ))}
            {!videos?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No videos found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
