'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Save,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Class, ClassLesson } from '@/types'

// ── Form schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(120),
  category: z.string().min(1, 'Please select a category'),
  type: z.string().min(1, 'Please select a type'),
  skill_level: z.string().min(1, 'Please select a skill level'),
  description: z.string().max(2000).optional(),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  thumbnail_url: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  scheduled_at: z.string().optional(),
  is_published: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const lessonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  video_id: z.string().optional(),
  is_free_preview: z.boolean(),
})
type LessonFormValues = z.infer<typeof lessonSchema>

// ── Component ─────────────────────────────────────────────────────────────────
interface EditClassClientProps {
  cls: Class & { lessons: ClassLesson[] }
}

export default function EditClassClient({ cls }: EditClassClientProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Lessons state — managed locally, synced to API on each action
  const [lessons, setLessons] = useState<ClassLesson[]>(
    [...(cls.lessons ?? [])].sort((a, b) => a.order_index - b.order_index)
  )
  const [addingLesson, setAddingLesson] = useState(false)
  const [lessonSaving, setLessonSaving] = useState(false)
  const [lessonError, setLessonError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Class form ──────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: cls.title,
      category: cls.category,
      type: cls.type,
      skill_level: cls.skill_level,
      description: cls.description ?? '',
      // price stored in cents in DB; display as dollars to the creator
      price: cls.price / 100,
      thumbnail_url: cls.thumbnail_url ?? '',
      scheduled_at: cls.scheduled_at
        ? new Date(cls.scheduled_at).toISOString().slice(0, 16)
        : '',
      is_published: cls.is_published,
    },
  })

  const classType = watch('type')
  const isPublished = watch('is_published')

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    setSaveSuccess(false)
    const res = await fetch(`/api/classes/${cls.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        // Convert back to cents for storage
        price: Math.round(values.price * 100),
        thumbnail_url: values.thumbnail_url || null,
        scheduled_at: values.scheduled_at || null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setServerError(data.error ?? 'Failed to save. Please try again.')
      return
    }
    setSaveSuccess(true)
    router.refresh()
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  // ── Lesson form ─────────────────────────────────────────────────────────────
  const lessonForm = useForm<LessonFormValues>({
    resolver: zodResolver(lessonSchema),
    defaultValues: { title: '', description: '', video_id: '', is_free_preview: false },
  })

  const onAddLesson = async (values: LessonFormValues) => {
    setLessonSaving(true)
    setLessonError(null)
    const res = await fetch(`/api/classes/${cls.id}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        video_id: values.video_id || null,
        order_index: lessons.length,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setLessonError(data.error ?? 'Failed to add lesson.')
      setLessonSaving(false)
      return
    }
    const newLesson = await res.json()
    setLessons((prev) => [...prev, newLesson])
    lessonForm.reset({ title: '', description: '', video_id: '', is_free_preview: false })
    setAddingLesson(false)
    setLessonSaving(false)
  }

  const togglePreview = async (lesson: ClassLesson) => {
    const res = await fetch(`/api/classes/${cls.id}/lessons/${lesson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_free_preview: !lesson.is_free_preview }),
    })
    if (res.ok) {
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lesson.id ? { ...l, is_free_preview: !l.is_free_preview } : l
        )
      )
    }
  }

  const deleteLesson = async (id: string) => {
    if (!confirm('Delete this lesson? This cannot be undone.')) return
    setDeletingId(id)
    const res = await fetch(`/api/classes/${cls.id}/lessons/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setLessons((prev) => prev.filter((l) => l.id !== id))
    }
    setDeletingId(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10">
      {/* ── Class details form ─────────────────────────────────────────────── */}
      <section className="border rounded-xl p-6 bg-card space-y-6">
        <h2 className="text-lg font-semibold">Class Details</h2>

        {serverError && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg px-4 py-3 text-sm">
            {serverError}
          </div>
        )}
        {saveSuccess && (
          <div className="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 rounded-lg px-4 py-3 text-sm">
            Changes saved successfully.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Category + Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
              <select
                id="category"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('category')}
              >
                <option value="baking">Baking</option>
                <option value="cooking">Cooking</option>
                <option value="pastry">Pastry</option>
                <option value="grilling">Grilling</option>
                <option value="international">International</option>
                <option value="vegan">Vegan</option>
                <option value="nutrition">Nutrition</option>
                <option value="general">General</option>
              </select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type">Type <span className="text-destructive">*</span></Label>
              <select
                id="type"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('type')}
              >
                <option value="recorded">Recorded</option>
                <option value="live">Live Class</option>
                <option value="series">Series</option>
              </select>
              {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
            </div>
          </div>

          {/* Skill level */}
          <div className="space-y-1.5">
            <Label htmlFor="skill_level">Skill Level <span className="text-destructive">*</span></Label>
            <select
              id="skill_level"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('skill_level')}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="all_levels">All Levels</option>
            </select>
            {errors.skill_level && <p className="text-xs text-destructive">{errors.skill_level.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={5}
              maxLength={2000}
              placeholder="What will students learn in this class? Who is it for?"
              {...register('description')}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          {/* Thumbnail URL */}
          <div className="space-y-1.5">
            <Label htmlFor="thumbnail_url">Thumbnail URL</Label>
            <Input
              id="thumbnail_url"
              type="url"
              placeholder="https://..."
              {...register('thumbnail_url')}
            />
            {errors.thumbnail_url && <p className="text-xs text-destructive">{errors.thumbnail_url.message}</p>}
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label htmlFor="price">Price (0 for free)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                className="pl-7"
                {...register('price')}
              />
            </div>
            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
          </div>

          {/* Scheduled at — live only */}
          {classType === 'live' && (
            <div className="space-y-1.5">
              <Label htmlFor="scheduled_at">Scheduled Date & Time</Label>
              <Input id="scheduled_at" type="datetime-local" {...register('scheduled_at')} />
            </div>
          )}

          {/* Published toggle */}
          <div className="flex items-center gap-3 pt-1">
            <input
              id="is_published"
              type="checkbox"
              className="h-4 w-4 rounded border border-input accent-primary"
              {...register('is_published')}
            />
            <Label htmlFor="is_published" className="cursor-pointer">
              {isPublished ? (
                <span className="text-green-600 dark:text-green-400 font-medium">Published — visible to students</span>
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">Draft — not visible to students</span>
              )}
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={`/classes/${cls.id}`} target="_blank" rel="noopener noreferrer" className="gap-2 inline-flex items-center">
                <ExternalLink className="h-4 w-4" />
                Preview Page
              </a>
            </Button>
          </div>
        </form>
      </section>

      {/* ── Lessons ────────────────────────────────────────────────────────── */}
      <section className="border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            Curriculum
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
            </span>
          </h2>
          {!addingLesson && (
            <Button size="sm" onClick={() => setAddingLesson(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Lesson
            </Button>
          )}
        </div>

        {/* Lesson list */}
        {lessons.length === 0 && !addingLesson && (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">
            No lessons yet. Add your first lesson to build the curriculum.
          </div>
        )}

        {lessons.map((lesson, idx) => (
          <div
            key={lesson.id}
            className="flex items-start gap-3 px-6 py-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
          >
            <GripVertical className="h-4 w-4 mt-1 text-muted-foreground/40 shrink-0" />
            <span className="text-sm text-muted-foreground w-5 mt-1 text-right shrink-0">{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{lesson.title}</p>
              {lesson.description && (
                <p className="text-xs text-muted-foreground truncate">{lesson.description}</p>
              )}
              {lesson.is_free_preview && (
                <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Free Preview
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={lesson.is_free_preview ? 'Remove free preview' : 'Mark as free preview'}
                onClick={() => togglePreview(lesson)}
              >
                {lesson.is_free_preview ? (
                  <Eye className="h-4 w-4 text-primary" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => deleteLesson(lesson.id)}
                disabled={deletingId === lesson.id}
              >
                {deletingId === lesson.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}

        {/* Add lesson form */}
        {addingLesson && (
          <div className="px-6 py-5 border-t bg-muted/20">
            <h3 className="text-sm font-semibold mb-4">New Lesson</h3>
            {lessonError && (
              <div className="mb-3 text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
                {lessonError}
              </div>
            )}
            <form onSubmit={lessonForm.handleSubmit(onAddLesson)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="lesson-title">Lesson Title <span className="text-destructive">*</span></Label>
                <Input
                  id="lesson-title"
                  placeholder="e.g. Introduction to Laminated Dough"
                  {...lessonForm.register('title')}
                />
                {lessonForm.formState.errors.title && (
                  <p className="text-xs text-destructive">{lessonForm.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lesson-description">Description (optional)</Label>
                <Textarea
                  id="lesson-description"
                  rows={2}
                  placeholder="What does this lesson cover?"
                  {...lessonForm.register('description')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lesson-video">
                  Video ID (optional)
                  <span className="ml-1 text-xs text-muted-foreground">— paste your uploaded video ID</span>
                </Label>
                <Input
                  id="lesson-video"
                  placeholder="Video UUID from your uploads"
                  {...lessonForm.register('video_id')}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="lesson-preview"
                  type="checkbox"
                  className="h-4 w-4 rounded border border-input accent-primary"
                  {...lessonForm.register('is_free_preview')}
                />
                <Label htmlFor="lesson-preview" className="cursor-pointer text-sm">
                  Free preview — non-enrolled students can watch this lesson
                </Label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={lessonSaving} className="gap-1.5">
                  {lessonSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add Lesson
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddingLesson(false)
                    setLessonError(null)
                    lessonForm.reset()
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  )
}
