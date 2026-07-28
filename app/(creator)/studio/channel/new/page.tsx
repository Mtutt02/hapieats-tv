import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import CreateChannelForm from '@/components/creator/CreateChannelForm'

export default async function NewChannelPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/studio/channel/new')

  // If the user already has a channel, they don't need to create one
  const { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('creator_id', user.id)
    .single()

  if (channel) redirect('/studio')

  return (
    <AppShell>
      <main className="max-w-xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Create Your Channel</h1>
          <p className="text-muted-foreground mt-2">
            Set up your channel to start uploading food videos and growing your audience.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <CreateChannelForm />
        </div>
      </main>
    </AppShell>
  )
}
