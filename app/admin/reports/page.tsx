import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AdminReportActions from '@/components/admin/AdminReportActions'

export const metadata: Metadata = { title: 'Reports', description: 'Review pending content reports on HapiEats TV.' }

export default async function AdminReportsPage() {
  const supabase = createClient()

  // Try to fetch reports (table may not exist yet if migration hasn't run)
  const { data: reports, error } = await supabase
    .from('content_reports')
    .select('*, reporter:profiles!reporter_id(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Content Reports</h1>
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <p className="mb-2">Reports table not yet created.</p>
          <p className="text-sm">Run the setup migration at <code className="bg-muted px-1 rounded">/api/admin/setup</code> to initialize it.</p>
        </div>
      </div>
    )
  }

  const pending = (reports ?? []).filter(r => r.status === 'pending')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Content Reports</h1>
        <p className="text-muted-foreground mt-1">
          {pending.length} pending · {(reports ?? []).length} total
        </p>
      </div>

      {pending.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm">
          ⚠ {pending.length} report(s) awaiting review
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reporter</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(reports ?? []).map(r => (
              <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{r.target_type}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.reason}</div>
                  {r.details && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{r.details}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {(r.reporter as any)?.display_name || (r.reporter as any)?.username}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === 'pending' ? 'bg-orange-500/10 text-orange-400' :
                    r.status === 'actioned' ? 'bg-green-500/10 text-green-400' :
                    r.status === 'dismissed' ? 'bg-muted text-muted-foreground' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <AdminReportActions reportId={r.id} targetType={r.target_type} targetId={r.target_id} status={r.status} />
                </td>
              </tr>
            ))}
            {!reports?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No reports yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
