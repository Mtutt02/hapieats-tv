import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import AcademyDashboard from '@/components/academy/builder/AcademyDashboard'

export const metadata: Metadata = {
  title: 'Creator Academy',
  description: 'Build and manage your cooking courses in the HapiEats Academy.',
}

export default async function AcademyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/academy')

  return (
    <AppShell>
      <AcademyDashboard />
    </AppShell>
  )
}
