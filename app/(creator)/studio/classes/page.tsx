import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'My Classes',
  description: 'Manage your cooking classes in HapiEats TV Creator Studio.',
}
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatViews } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { GraduationCap, Plus, Users, Radio, Film, BookOpen, Edit } from 'lucide-react'
import type { Class } from '@/types'

export default async function StudioClassesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/studio/classes')

  const { data: classes } = await supabase
    .from('classes')
    .select(`
      *,
      instructor:profiles(id, username, display_name, avatar_url)
    `)
    .eq('instructor_id', user.id)
    .order('created_at', { ascending: false })

  const totalClasses = classes?.length ?? 0
  const totalEnrollments = classes?.reduce((acc, c) => acc + (c.enrollment_count ?? 0), 0) ?? 0
  const liveClasses = classes?.filter((c) => c.type === 'live').length ?? 0

  const typeBadgeStyle: Record<string, string> = {
    live: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    series: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    recorded: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  }

  const typeLabel: Record<string, string> = {
    live: 'LIVE',
    series: 'Series',
    recorded: 'Recorded',
  }

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6" />
              My Classes
            </h1>
            <p className="text-muted-foreground mt-1">Create and manage your cooking classes</p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/studio/classes/new">
              <Plus className="h-4 w-4" />
              Create New Class
            </Link>
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border rounded-xl p-4 text-center bg-card">
            <p className="text-3xl font-bold">{totalClasses}</p>
            <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <BookOpen className="h-4 w-4" /> Total Classes
            </p>
          </div>
          <div className="border rounded-xl p-4 text-center bg-card">
            <p className="text-3xl font-bold">{formatViews(totalEnrollments)}</p>
            <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <Users className="h-4 w-4" /> Total Students
            </p>
          </div>
          <div className="border rounded-xl p-4 text-center bg-card">
            <p className="text-3xl font-bold">{liveClasses}</p>
            <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <Radio className="h-4 w-4" /> Live Classes
            </p>
          </div>
        </div>

        {/* Classes table / list */}
        {classes && classes.length > 0 ? (
          <div className="border rounded-xl overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Class</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Students</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Price</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(classes as Class[]).map((cls) => (
                  <tr key={cls.id} className="hover:bg-muted/30 transition-colors">
                    {/* Class info */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium line-clamp-1">{cls.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{cls.category}</p>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', typeBadgeStyle[cls.type] ?? 'bg-gray-100 text-gray-800')}>
                        {typeLabel[cls.type] ?? cls.type}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        cls.is_published
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      )}>
                        {cls.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>

                    {/* Enrollment */}
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <div className="flex items-center justify-end gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {formatViews(cls.enrollment_count ?? 0)}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-right hidden lg:table-cell font-medium">
                      {(cls.price ?? 0) === 0 ? (
                        <span className="text-green-600 dark:text-green-400">Free</span>
                      ) : (
                        formatCurrency(cls.price ?? 0)
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/studio/classes/${cls.id}/edit`}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-24 border rounded-xl bg-card">
            <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No classes yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first class to start teaching!
            </p>
            <Button asChild className="gap-2">
              <Link href="/studio/classes/new">
                <Plus className="h-4 w-4" />
                Create Your First Class
              </Link>
            </Button>
          </div>
        )}
      </main>
    </AppShell>
  )
}
