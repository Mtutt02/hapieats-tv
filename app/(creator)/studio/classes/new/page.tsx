import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import CreateClassForm from '@/components/creator/CreateClassForm'
import { GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function NewClassPage({
  searchParams,
}: {
  searchParams: { type?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/studio/classes/new')

  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, slug')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: true })

  if (!channels || channels.length === 0) {
    redirect('/studio/channel/new')
  }

  const initialType = searchParams.type === 'live' ? 'live'
    : searchParams.type === 'recorded' ? 'recorded'
    : undefined

  return (
    <AppShell>
      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/studio" className="hover:text-foreground transition-colors">Studio</Link>
          <span>/</span>
          <Link href="/studio/classes" className="hover:text-foreground transition-colors">Classes</Link>
          <span>/</span>
          <span className="text-foreground">New Class</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {initialType === 'live' ? 'Schedule a Live Class' : initialType === 'recorded' ? 'Create a Pre-Recorded Class' : 'Create a New Class'}
            </h1>
            <p className="text-muted-foreground text-sm">Share your culinary knowledge with students</p>
          </div>
        </div>

        <div className="border rounded-xl p-6 bg-card">
          <CreateClassForm channels={channels} initialType={initialType} />
        </div>
      </main>
    </AppShell>
  )
}
