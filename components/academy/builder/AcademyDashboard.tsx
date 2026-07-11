'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GraduationCap, Plus, Users, BookOpen, DollarSign, Radio, Loader2 } from 'lucide-react'
import type { Course } from '@/lib/academy/types'
import { FormatBadge, LevelBadge, PriceBadge, StatusBadge } from './badges'

type Tab = 'courses' | 'cohorts' | 'earnings'

export default function AcademyDashboard() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('courses')

  useEffect(() => {
    let active = true
    fetch('/api/academy/courses')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load courses'))))
      .then((data) => {
        if (!active) return
        setCourses(Array.isArray(data) ? data : data.courses ?? [])
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const totalCourses = courses.length
  const totalEnrollments = courses.reduce((a, c) => a + (c.enrollment_count ?? 0), 0)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'courses', label: 'Courses' },
    { key: 'cohorts', label: 'Live Cohorts' },
    { key: 'earnings', label: 'Earnings' },
  ]

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-zinc-100">
            <GraduationCap className="h-6 w-6" />
            Creator Academy
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">Build courses, teach cohorts, earn from the Pro pool</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/academy/new">
            <Plus className="h-4 w-4" />
            New course
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatTile icon={<BookOpen className="h-4 w-4" />} label="Total courses" value={totalCourses} />
        <StatTile icon={<Users className="h-4 w-4" />} label="Total enrollments" value={totalEnrollments} />
        <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/60 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-sm text-zinc-400">
            <DollarSign className="h-4 w-4" /> Earnings
          </div>
          <Link href="/studio/dashboard/monetize" className="text-xs text-indigo-400 hover:text-indigo-300 mt-2">
            View earnings in Studio →
          </Link>
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              'px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ' +
              (tab === t.key
                ? 'border-indigo-500 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'courses' && (
        <CoursesTab courses={courses} loading={loading} error={error} />
      )}
      {tab === 'cohorts' && (
        <div className="text-center py-16 border border-zinc-800 rounded-xl bg-zinc-900/40">
          <Radio className="h-10 w-10 mx-auto text-zinc-600 mb-3" />
          <p className="text-zinc-300 mb-4">Run scheduled live cohorts for your hybrid & live courses.</p>
          <Button asChild variant="outline">
            <Link href="/academy/cohorts">Manage cohorts</Link>
          </Button>
        </div>
      )}
      {tab === 'earnings' && (
        <div className="text-center py-16 border border-zinc-800 rounded-xl bg-zinc-900/40">
          <DollarSign className="h-10 w-10 mx-auto text-zinc-600 mb-3" />
          <p className="text-zinc-300 mb-2">Two payout rails: 80% of direct class sales, plus a share of the Pro all-access pool.</p>
          <p className="text-zinc-500 text-sm mb-4">Detailed payout history lives in Creator Studio.</p>
          <Button asChild variant="outline">
            <Link href="/studio/dashboard/monetize">Open Studio earnings</Link>
          </Button>
        </div>
      )}
    </main>
  )
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/60">
      <p className="text-3xl font-bold text-zinc-100">{value}</p>
      <p className="text-sm text-zinc-400 mt-1 flex items-center gap-1">
        {icon} {label}
      </p>
    </div>
  )
}

function CoursesTab({ courses, loading, error }: { courses: Course[]; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="text-center py-16 border border-zinc-800 rounded-xl bg-zinc-900/40 text-zinc-400">
        {error}
      </div>
    )
  }
  if (courses.length === 0) {
    return (
      <div className="text-center py-24 border border-zinc-800 rounded-xl bg-zinc-900/40">
        <GraduationCap className="h-14 w-14 mx-auto text-zinc-700 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-200 mb-2">No courses yet</h3>
        <p className="text-zinc-400 mb-6">Create your first course to start teaching.</p>
        <Button asChild className="gap-2">
          <Link href="/academy/new">
            <Plus className="h-4 w-4" /> New course
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {courses.map((c) => (
        <Link
          key={c.id}
          href={`/academy/${c.id}`}
          className="block border border-zinc-800 rounded-xl p-4 bg-zinc-900/60 hover:bg-zinc-900 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-zinc-100 truncate">{c.title}</p>
              <p className="text-xs text-zinc-500 capitalize mt-0.5">{c.category}</p>
            </div>
            <StatusBadge published={c.is_published} />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <FormatBadge format={c.format} />
            <LevelBadge level={c.level} />
            <PriceBadge pricing={c.pricing_model} price={c.price} />
            {c.pro_included && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300">
                In Pro
              </span>
            )}
            <span className="ml-auto text-xs text-zinc-500 flex items-center gap-1">
              <Users className="h-3 w-3" /> {c.enrollment_count ?? 0} enrolled
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
