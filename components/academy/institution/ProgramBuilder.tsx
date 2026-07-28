'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CourseRef {
  id: string
  title: string
}

interface ProgramBuilderProps {
  programId: string
  /** Ordered courses already attached to the program. */
  initialCourses: CourseRef[]
  /** Courses the owner can pick from (their catalog). */
  available: CourseRef[]
}

/**
 * Owner tool to attach, remove, and reorder a program's courses.
 * On save it PATCHes /api/academy/programs/[programId] with the full
 * ordered { courseIds } list, which replaces program_courses atomically.
 */
export default function ProgramBuilder({ programId, initialCourses, available }: ProgramBuilderProps) {
  const [selected, setSelected] = useState<CourseRef[]>(initialCourses)
  const [pickId, setPickId] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const selectedIds = new Set(selected.map((c) => c.id))
  const pickable = available.filter((c) => !selectedIds.has(c.id))

  function add() {
    const c = available.find((x) => x.id === pickId)
    if (c && !selectedIds.has(c.id)) setSelected((s) => [...s, c])
    setPickId('')
  }
  function remove(id: string) {
    setSelected((s) => s.filter((c) => c.id !== id))
  }
  function move(index: number, dir: -1 | 1) {
    setSelected((s) => {
      const next = [...s]
      const j = index + dir
      if (j < 0 || j >= next.length) return next
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/academy/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds: selected.map((c) => c.id) }),
      })
      const data = await res.json()
      setMsg(res.ok ? 'Curriculum saved' : data.error || 'Save failed')
    } catch {
      setMsg('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Add a course</label>
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Select a course…</option>
            {pickable.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <Button type="button" onClick={add} disabled={!pickId}>Add</Button>
      </div>

      <ol className="space-y-2">
        {selected.length === 0 && (
          <li className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No courses yet. Add courses to build the curriculum.
          </li>
        )}
        {selected.map((c, i) => (
          <li key={c.id} className="flex items-center gap-3 rounded-md border p-3">
            <span className="w-6 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
            <span className="flex-1 text-sm">{c.title}</span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === selected.length - 1}>↓</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(c.id)}>Remove</Button>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save curriculum'}</Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  )
}
