import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import SuperadminControlPanel from './SuperadminControlPanel'

export const metadata = { title: 'Platform Settings', description: 'Configure HapiEats TV platform settings.' }

export default async function AdminSettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/settings')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'superadmin'].includes(me.role ?? '')) redirect('/?error=unauthorized')

  const service = createServiceClient()

  // All users (for full user management)
  const { data: allUsers } = await service
    .from('profiles')
    .select('id, username, display_name, role, is_creator, suspended_at, suspension_reason, created_at, avatar_url, email')
    .order('created_at', { ascending: false })

  // Admin team
  const { data: team } = await service
    .from('profiles')
    .select('id, username, display_name, role, created_at, suspended_at')
    .in('role', ['moderator', 'admin', 'superadmin'])
    .order('role', { ascending: false })

  // Platform stats
  const [
    { count: totalUsers },
    { count: totalVideos },
    { count: activeCreators },
    { count: suspendedUsers },
  ] = await Promise.all([
    service.from('profiles').select('*', { count: 'exact', head: true }),
    service.from('videos').select('*', { count: 'exact', head: true }),
    service.from('profiles').select('*', { count: 'exact', head: true }).eq('is_creator', true),
    service.from('profiles').select('*', { count: 'exact', head: true }).not('suspended_at', 'is', null),
  ])

  return (
    <SuperadminControlPanel
      currentUserRole={me.role ?? 'admin'}
      currentUserId={user.id}
      allUsers={allUsers ?? []}
      team={team ?? []}
      stats={{
        totalUsers: totalUsers ?? 0,
        totalVideos: totalVideos ?? 0,
        activeCreators: activeCreators ?? 0,
        suspendedUsers: suspendedUsers ?? 0,
      }}
    />
  )
}
