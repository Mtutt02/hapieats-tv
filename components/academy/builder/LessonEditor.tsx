'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, Plus, Film, Check, ChevronDown, ChevronRight } from 'lucide-react'
import type { CourseLesson, LessonResource, Chapter, Recipe } from '@/lib/academy/types'
import RecipeEditor from './RecipeEditor'

interface ReadyVideo {
  id: string
  title: string
  mux_playback_id: string | null
  duration: number | null
}

const inputCls =
  'w-full px-2.5 py-1.5 rounded-md bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500'

export default function LessonEditor({
  lesson,
  onPatch,
  onDelete,
}: {
  lesson: CourseLesson
  onPatch: (id: string, patch: Partial<CourseLesson>) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(lesson.title)
  const [description, setDescription] = useState(lesson.description ?? '')
  const [videos, setVideos] = useState<ReadyVideo[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showRecipe, setShowRecipe] = useState(Boolean(lesson.recipe))
  const [recipe, setRecipe] = useState<Recipe | null>(lesson.recipe ?? null)

  useEffect(() => {
    if (!open || videos.length) return
    setLoadingVideos(true)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) {
        setLoadingVideos(false)
        return
      }
      supabase
        .from('videos')
        .select('id, title, mux_playback_id, duration')
        .eq('creator_id', uid)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .then(({ data: rows }) => {
          setVideos((rows as ReadyVideo[]) ?? [])
          setLoadingVideos(false)
        })
    })
  }, [open, videos.length])

  async function saveMeta(patch: Partial<CourseLesson>) {
    setSaving(true)
    setSaved(false)
    onPatch(lesson.id, patch) // optimistic
    try {
      const res = await fetch(`/api/academy/lessons/${lesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const attachVideo = (v: ReadyVideo) =>
    saveMeta({ video_id: v.id, mux_playback_id: v.mux_playback_id, duration: v.duration })

  const resources = lesson.resources ?? []
  const chapters = lesson.chapters ?? []

  const addResource = () =>
    saveMeta({ resources: [...resources, { name: '', url: '' } as LessonResource] })
  const setResource = (i: number, patch: Partial<LessonResource>) =>
    onPatch(lesson.id, { resources: resources.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
  const commitResources = () => saveMeta({ resources })

  const addChapter = () => saveMeta({ chapters: [...chapters, { t: 0, label: '' } as Chapter] })
  const setChapter = (i: number, patch: Partial<Chapter>) =>
    onPatch(lesson.id, { chapters: chapters.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
  const commitChapters = () => saveMeta({ chapters })

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center gap-2 p-3">
        <button onClick={() => setOpen((o) => !o)} className="text-zinc-500 hover:text-zinc-300">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="flex-1 text-sm text-zinc-200 truncate">{lesson.title || 'Untitled lesson'}</span>
        {lesson.is_free_preview && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-300">Preview</span>
        )}
        {lesson.video_id && <Film className="h-3.5 w-3.5 text-indigo-400" />}
        <button onClick={() => onDelete(lesson.id)} className="text-zinc-600 hover:text-red-400">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="border-t border-zinc-800 p-4 space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title !== lesson.title && saveMeta({ title })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Description</label>
            <textarea
              value={description}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (lesson.description ?? '') && saveMeta({ description })}
              className={inputCls}
            />
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-1.5">Video</p>
            {loadingVideos ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading library…
              </div>
            ) : videos.length === 0 ? (
              <p className="text-xs text-zinc-600">No ready videos in your library yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                {videos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => attachVideo(v)}
                    className={
                      'text-left text-xs px-2.5 py-1.5 rounded-md border truncate ' +
                      (lesson.video_id === v.id
                        ? 'border-indigo-500 bg-indigo-500/10 text-zinc-100'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700')
                    }
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={lesson.is_free_preview}
              onChange={(e) => saveMeta({ is_free_preview: e.target.checked })}
              className="h-4 w-4 accent-indigo-500"
            />
            Free preview lesson
          </label>

          <div>
            <p className="text-xs text-zinc-500 mb-1.5">Resources</p>
            {resources.map((r, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input placeholder="name" value={r.name} onChange={(e) => setResource(i, { name: e.target.value })} onBlur={commitResources} className={inputCls + ' flex-1'} />
                <input placeholder="https://" value={r.url} onChange={(e) => setResource(i, { url: e.target.value })} onBlur={commitResources} className={inputCls + ' flex-1'} />
                <button onClick={() => saveMeta({ resources: resources.filter((_, idx) => idx !== i) })} className="text-zinc-600 hover:text-red-400 px-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button onClick={addResource} className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add resource
            </button>
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-1.5">Chapters</p>
            {chapters.map((c, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input placeholder="sec" value={c.t} onChange={(e) => setChapter(i, { t: Number(e.target.value) || 0 })} onBlur={commitChapters} className={inputCls + ' w-20'} />
                <input placeholder="label" value={c.label} onChange={(e) => setChapter(i, { label: e.target.value })} onBlur={commitChapters} className={inputCls + ' flex-1'} />
                <button onClick={() => saveMeta({ chapters: chapters.filter((_, idx) => idx !== i) })} className="text-zinc-600 hover:text-red-400 px-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button onClick={addChapter} className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add chapter
            </button>
          </div>

          <div>
            {!showRecipe ? (
              <button onClick={() => setShowRecipe(true)} className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add recipe
              </button>
            ) : (
              <RecipeEditor lessonId={lesson.id} recipe={recipe} onSaved={setRecipe} />
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-500 h-4">
            {saving && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </>
            )}
            {!saving && saved && (
              <>
                <Check className="h-3 w-3 text-green-400" /> Saved
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
