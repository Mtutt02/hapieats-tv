'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Plus, GripVertical, Trash2, Upload, Play, Radio,
  FileText, CheckCircle, Eye, EyeOff, Loader2, AlertCircle, Edit2, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Lesson {
  id: string
  title: string
  description?: string | null
  duration_seconds?: number | null
  mux_playback_id?: string | null
  mux_asset_id?: string | null
  lesson_type: 'video' | 'live' | 'text' | 'quiz'
  is_preview: boolean
  position: number
  live_scheduled_at?: string | null
}

interface Section {
  id: string
  title: string
  position: number
  lessons: Lesson[]
}

interface CourseEditorProps {
  course: {
    id: string
    title: string
    status: string
    thumbnail_url?: string | null
    pricing_model: string
    price_usd?: number | null
  }
  sections: Section[]
}

const LESSON_ICON: Record<string, React.ElementType> = {
  video: Play,
  live: Radio,
  text: FileText,
  quiz: CheckCircle,
}

// ── Inline-editable label ──────────────────────────────────────────────────────
function InlineEdit({ value, onSave, className = '' }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    const trimmed = val.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus
        className={cn('bg-muted border border-border rounded-lg px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary', className)}
      />
    )
  }
  return (
    <button
      onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }}
      className={cn('flex items-center gap-1 hover:text-primary transition-colors text-left', className)}
    >
      {value}
      <Edit2 className="h-3 w-3 opacity-50 flex-shrink-0" />
    </button>
  )
}

// ── Upload button for a lesson ─────────────────────────────────────────────────
function LessonUploadButton({ lessonId, courseId, onUploaded }: {
  lessonId: string
  courseId: string
  onUploaded: (muxPlaybackId: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      // 1. Get Mux upload URL
      const res = await fetch('/api/courses/lesson-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, courseId }),
      })
      const json = await res.json().catch(() => ({})) as { uploadUrl?: string; assetId?: string; error?: string }
      if (!res.ok || !json.uploadUrl) {
        setError(json.error ?? 'Failed to get upload URL')
        return
      }

      // 2. PUT file directly to Mux
      await fetch(json.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      // 3. Poll for Mux asset ready (up to 60s)
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const statusRes = await fetch(`/api/courses/lesson-asset-status?lessonId=${lessonId}`)
        const status = await statusRes.json().catch(() => ({})) as { ready?: boolean; playbackId?: string }
        if (status.ready && status.playbackId) {
          onUploaded(status.playbackId)
          return
        }
      }
      setError('Upload is processing — check back in a few minutes')
    } catch {
      setError('Upload failed — please try again')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 text-xs px-2 py-1 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
      {error && <p className="text-destructive text-[11px] mt-1">{error}</p>}
    </div>
  )
}

// ── Main CourseEditor ──────────────────────────────────────────────────────────
export default function CourseEditor({ course, sections: initialSections }: CourseEditorProps) {
  const router = useRouter()
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [publishing, setPublishing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [publishStatus, setPublishStatus] = useState(course.status)

  // ── Section operations ───────────────────────────────────────────────────────
  const addSection = async () => {
    const title = `Section ${sections.length + 1}`
    const res = await fetch('/api/courses/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: course.id, title, position: sections.length }),
    })
    const json = await res.json().catch(() => ({})) as { section?: Section }
    if (json.section) setSections(prev => [...prev, { ...json.section!, lessons: [] }])
  }

  const updateSectionTitle = async (sectionId: string, title: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title } : s))
    await fetch(`/api/courses/sections/${sectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
  }

  const deleteSection = async (sectionId: string) => {
    if (!confirm('Delete this section and all its lessons?')) return
    const res = await fetch(`/api/courses/sections/${sectionId}`, { method: 'DELETE' })
    if (res.ok) setSections(prev => prev.filter(s => s.id !== sectionId))
  }

  // ── Lesson operations ────────────────────────────────────────────────────────
  const addLesson = async (sectionId: string, lessonType: Lesson['lesson_type'] = 'video') => {
    const section = sections.find(s => s.id === sectionId)
    const position = section?.lessons.length ?? 0
    const res = await fetch('/api/courses/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, courseId: course.id, title: 'New Lesson', lessonType, position }),
    })
    const json = await res.json().catch(() => ({})) as { lesson?: Lesson }
    if (json.lesson) {
      setSections(prev => prev.map(s =>
        s.id === sectionId ? { ...s, lessons: [...s.lessons, json.lesson!] } : s,
      ))
    }
  }

  const updateLessonTitle = async (sectionId: string, lessonId: string, title: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, title } : l) }
        : s,
    ))
    await fetch(`/api/courses/lessons/${lessonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
  }

  const togglePreview = async (sectionId: string, lessonId: string, current: boolean) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, is_preview: !current } : l) }
        : s,
    ))
    await fetch(`/api/courses/lessons/${lessonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPreview: !current }),
    })
  }

  const deleteLesson = async (sectionId: string, lessonId: string) => {
    const res = await fetch(`/api/courses/lessons/${lessonId}`, { method: 'DELETE' })
    if (res.ok) {
      setSections(prev => prev.map(s =>
        s.id === sectionId ? { ...s, lessons: s.lessons.filter(l => l.id !== lessonId) } : s,
      ))
    }
  }

  const onVideoUploaded = (sectionId: string, lessonId: string, playbackId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, mux_playback_id: playbackId } : l) }
        : s,
    ))
  }

  // ── Publish / Unpublish ──────────────────────────────────────────────────────
  const handlePublishToggle = async () => {
    setPublishing(true)
    setSaveError(null)
    const newStatus = publishStatus === 'published' ? 'draft' : 'published'
    try {
      const res = await fetch(`/api/courses/${course.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok) { setSaveError(json.error ?? 'Failed to update status'); return }
      setPublishStatus(newStatus)
    } catch {
      setSaveError('Network error — please try again')
    } finally {
      setPublishing(false)
    }
  }

  const totalLessons = sections.reduce((n, s) => n + s.lessons.length, 0)

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Link
            href="/creator/courses"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-1 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            My Courses
          </Link>
          <h1 className="text-xl font-bold leading-snug">{course.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalLessons} lessons · {publishStatus === 'published' ? '🟢 Published' : '⚪ Draft'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {publishStatus === 'published' && (
            <Link
              href={`/courses/${course.id}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </Link>
          )}
          <Button
            onClick={handlePublishToggle}
            disabled={publishing}
            variant={publishStatus === 'published' ? 'outline' : 'default'}
            className="text-sm"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : publishStatus === 'published' ? (
              <><EyeOff className="h-4 w-4 mr-1.5" />Unpublish</>
            ) : (
              <><Eye className="h-4 w-4 mr-1.5" />Publish</>
            )}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {saveError}
        </div>
      )}

      {/* Curriculum */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.id} className="border border-border rounded-2xl overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/40">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <InlineEdit
                value={section.title}
                onSave={(v) => updateSectionTitle(section.id, v)}
                className="flex-1 font-semibold text-sm"
              />
              <button
                onClick={() => deleteSection(section.id)}
                className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Lessons */}
            <div className="divide-y divide-border/50">
              {section.lessons.map((lesson) => {
                const Icon = LESSON_ICON[lesson.lesson_type] ?? Play
                return (
                  <div key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <InlineEdit
                        value={lesson.title}
                        onSave={(v) => updateLessonTitle(section.id, lesson.id, v)}
                        className="text-sm"
                      />
                      <div className="flex items-center gap-2 mt-1">
                        {lesson.mux_playback_id ? (
                          <span className="text-[10px] text-green-400 font-semibold flex items-center gap-1">
                            <Check className="h-3 w-3" />Video ready
                          </span>
                        ) : lesson.lesson_type === 'video' ? (
                          <LessonUploadButton
                            lessonId={lesson.id}
                            courseId={course.id}
                            onUploaded={(pid) => onVideoUploaded(section.id, lesson.id, pid)}
                          />
                        ) : null}
                      </div>
                    </div>

                    {/* Preview toggle */}
                    <button
                      onClick={() => togglePreview(section.id, lesson.id, lesson.is_preview)}
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors',
                        lesson.is_preview
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40',
                      )}
                    >
                      {lesson.is_preview ? 'Preview' : 'Locked'}
                    </button>

                    <button
                      onClick={() => deleteLesson(section.id, lesson.id)}
                      className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add lesson row */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50 bg-muted/20">
              <button
                onClick={() => addLesson(section.id, 'video')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <Play className="h-3 w-3" />
                Video
              </button>
              <span className="text-muted-foreground text-xs">·</span>
              <button
                onClick={() => addLesson(section.id, 'live')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <Radio className="h-3 w-3" />
                Live
              </button>
              <span className="text-muted-foreground text-xs">·</span>
              <button
                onClick={() => addLesson(section.id, 'text')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <FileText className="h-3 w-3" />
                Text
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add section */}
      <button
        onClick={addSection}
        className="mt-4 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border hover:border-primary/50 rounded-2xl text-muted-foreground hover:text-primary text-sm font-semibold transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Section
      </button>
    </div>
  )
}
