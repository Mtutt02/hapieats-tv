import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import NewCourseForm from '@/components/academy/builder/NewCourseForm'
import { GraduationCap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'New Course · Academy',
  description: 'Create a new cooking course in the HapiEats Academy.',
}

export default async function NewAcademyCoursePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/academy/new')

  return (
    <AppShell>
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link href="/academy" className="hover:text-zinc-300 transition-colors">Academy</Link>
          <span>/</span>
          <span className="text-zinc-300">New course</span>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Create a new course</h1>
            <p className="text-zinc-400 text-sm">Set the basics, then choose how you monetize it.</p>
          </div>
        </div>

        <NewCourseForm />
      </main>
    </AppShell>
  )
}
