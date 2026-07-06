import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import EditClassClient from '@/components/creator/EditClassClient'
import { GraduationCap } from 'lucide-react'
import type { Class, ClassLesson } from '@/types'

export const metadata: Metadata = {
  title: 'Edit Class',
  description: 'Edit your cooking class in HapiEats TV Creator Studio.',
}

interface PageProps {
  params: { classId: string }
}

export default async function EditClassPage({ params }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/studio/classes/${params.classId}/edit`)

  const { data: cls } = await supabase
    .from('classes')
    .select(`
      *,
      instructor:profiles(id, username, display_name, avatar_url),
      channel:channels(id, name, slug),
      lessons:class_lessons(*)
    `)
    .eq('id', params.classId)
    .eq('instructor_id', user.id)
    .single()

  if (!cls) notFound()

  // Sort lessons by order_index
  const sortedLessons: ClassLesson[] = ((cls.lessons ?? []) as ClassLesson[]).sort(
    (a, b) => a.order_index - b.order_index
  )

  const clsWithLessons = { ...(cls as Class), lessons: sortedLessons }

  return (
    <AppShell>
      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/studio" className="hover:text-foreground transition-colors">Studio</Link>
          <span>/</span>
          <Link href="/studio/classes" className="hover:text-foreground transition-colors">Classes</Link>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{cls.title}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">Edit Class</h1>
            <p className="text-muted-foreground text-sm truncate">{cls.title}</p>
          </div>
        </div>

        <EditClassClient cls={clsWithLessons} />
      </main>
    </AppShell>
  )
}
