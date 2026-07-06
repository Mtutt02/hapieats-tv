import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import { redirect } from 'next/navigation'
import CreateCourseForm from '@/components/courses/CreateCourseForm'

export const dynamic = 'force-dynamic'

export default async function CreateCoursePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/creator/courses/create')

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Create a Course</h1>
        <CreateCourseForm userId={user.id} />
      </div>
    </AppShell>
  )
}
