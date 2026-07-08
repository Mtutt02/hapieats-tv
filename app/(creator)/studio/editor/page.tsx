import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Video Editor',
  description: 'Advanced video editor with timeline, trimming, text, music, and more.',
}

export default async function EditorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/studio/editor')

  return (
    <AppShell>
      <div className="w-full h-[calc(100vh-64px)]">
        <iframe
          src="https://clip-js-nu.vercel.app/projects"
          className="w-full h-full border-0"
          allow="clipboard-write; clipboard-read"
          title="Video Editor"
        />
      </div>
    </AppShell>
  )
}
