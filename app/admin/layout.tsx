import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'

export const metadata = { title: 'Admin — HapiEats TV' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'superadmin', 'moderator'].includes(profile.role ?? '')) {
    redirect('/?error=unauthorized')
  }

  return (
    <AdminShell role={profile.role ?? 'moderator'} displayName={profile.display_name ?? ''}>
      {children}
    </AdminShell>
  )
}
