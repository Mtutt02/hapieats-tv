import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import FullSettingsClient from '@/components/settings/FullSettingsClient'
import type { Profile } from '@/types'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your HapiEats TV account settings.',
}

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/settings')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">Account Settings</h1>
        <FullSettingsClient profile={profile as Profile} email={user.email ?? ''} />
      </main>
    </AppShell>
  )
}
