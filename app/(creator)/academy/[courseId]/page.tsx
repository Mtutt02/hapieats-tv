import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import CourseBuilder from '@/components/academy/builder/CourseBuilder'

export const metadata: Metadata = {
  title: 'Course Builder · Academy',
  description: 'Edit sections, lessons and recipes for your course.',
}

export default async function CourseBuilderPage({ params }: { params: { courseId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/academy/${params.courseId}`)

  return (
    <AppShell>
      <CourseBuilder courseId={params.courseId} />
    </AppShell>
  )
}
