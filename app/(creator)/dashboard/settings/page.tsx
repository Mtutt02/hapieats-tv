import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import ProfileSettingsForm from '@/components/creator/ProfileSettingsForm'

export const metadata: Metadata = {
  title: 'Profile & Channel Settings',
  description: 'Update your profile, channel branding, and pricing on HapiEats TV.',
}
import ChannelSettingsForm from '@/components/creator/ChannelSettingsForm'
import ChangePasswordForm from '@/components/settings/ChangePasswordForm'
import type { Profile, Channel } from '@/types'

export default async function SettingsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/dashboard/settings')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: channel } = await supabase
    .from('channels')
    .select('*')
    .eq('creator_id', user.id)
    .single()

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">Settings</h1>

        {/* Profile Settings */}
        <section className="mb-10">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Profile Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Update your public profile information.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <ProfileSettingsForm profile={profile as Profile} />
          </div>
        </section>

        <div className="border-t mb-10" />

        {/* Channel Settings */}
        <section>
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Channel Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure your creator channel details and monetization.
            </p>
          </div>

          {channel ? (
            <div className="rounded-xl border bg-card p-6">
              <ChannelSettingsForm channel={channel as Channel} />
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-6 text-center space-y-3">
              <p className="text-muted-foreground text-sm">
                You don&apos;t have a channel yet. Create one to start uploading and
                monetizing your food videos.
              </p>
              <Link
                href="/studio/channel/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
              >
                Create your channel
              </Link>
            </div>
          )}
        </section>

        <div className="border-t my-10" />

        {/* Password */}
        <section>
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Password</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Change your account password. You&apos;ll need your current password to confirm.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <ChangePasswordForm />
          </div>
        </section>
      </main>
    </AppShell>
  )
}
