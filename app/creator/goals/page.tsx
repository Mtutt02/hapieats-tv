import { createClient, createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import CreatorGoalsClient from '@/components/goals/CreatorGoalsClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Creator Goals — HapiEats TV' }

export default async function CreatorGoalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/creator/goals')

  const { data: profile } = await supabase.from('profiles').select('is_creator, display_name').eq('id', user.id).single()
  if (!profile?.is_creator) redirect('/dashboard')

  const service = createServiceClient()

  const { data: goals } = await service
    .from('creator_goals')
    .select('*')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <AppShell>
      <CreatorGoalsClient goals={(goals ?? []) as any[]} creatorId={user.id} />
    </AppShell>
  )
}
