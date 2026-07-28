import type { Metadata } from 'next'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminUserActions from '@/components/admin/AdminUserActions'

export const metadata: Metadata = { title: 'Users', description: 'Manage HapiEats TV users.' }

export default async function AdminUsersPage() {
  // Defense-in-depth: check auth even though layout also guards this
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!me || !['admin', 'superadmin', 'moderator'].includes(me.role ?? '')) {
    redirect('/')
  }

  // Use service client for consistent admin data (bypasses RLS)
  const service = createServiceClient()
  const { data: users } = await service
    .from('profiles')
    .select('id, username, display_name, role, is_creator, suspended_at, suspension_reason, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground mt-1">{users?.length ?? 0} users registered</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Creator</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(users ?? []).map(u => (
              <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.display_name || u.username || '—'}</div>
                  <div className="text-xs text-muted-foreground">@{u.username}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.role === 'superadmin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                    u.role === 'admin' ? 'bg-primary/10 text-primary border border-primary/20' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {u.role ?? 'user'}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {u.is_creator ? '✓' : '—'}
                </td>
                <td className="px-4 py-3">
                  {u.suspended_at ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      Suspended
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <AdminUserActions
                    userId={u.id}
                    role={u.role}
                    suspended={!!u.suspended_at}
                    isCreator={!!u.is_creator}
                    callerRole={me.role ?? 'user'}
                  />
                </td>
              </tr>
            ))}
            {!users?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
