import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import VideoTable from '@/components/creator/VideoTable'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Video } from '@/types'

export const metadata: Metadata = {
  title: 'Manage Videos',
  description: 'View and manage all your videos in HapiEats TV Creator Studio.',
}

export default async function StudioVideosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/studio/videos')

  const { data: videos } = await supabase
    .from('videos')
    .select('*, channel:channels(id, name, slug)')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your Videos</h1>
          <Button asChild>
            <Link href="/studio/upload">+ Upload</Link>
          </Button>
        </div>
        <VideoTable videos={(videos as Video[]) ?? []} />
      </main>
    </AppShell>
  )
}
