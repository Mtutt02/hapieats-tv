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
import { Loader2 } from 'lucide-react'

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(120, 'Title must be under 120 characters'),
  category: z.string().min(1, 'Please select a category'),
  type: z.string().min(1, 'Please select a type'),
  skill_level: z.string().min(1, 'Please select a skill level'),
  description: z.string().max(2000, 'Description must be under 2000 characters').optional(),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  channel_id: z.string().min(1, 'Please select a channel'),
  scheduled_at: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface CreateClassFormProps {
  channels: { id: string; name: string }[]
  initialType?: 'recorded' | 'live' | 'series'
}

export default function CreateClassForm({ channels, initialType }: CreateClassFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      price: 0,
      category: '',
      type: initialType ?? '',
      skill_level: '',
      channel_id: channels[0]?.id ?? '',
    },
  })

  const classType = watch('type')

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          // price is stored in cents in the DB; formatCurrency() and the Stripe
          // checkout route both expect cents, so convert from the user-entered dollar value.
          price: Math.round(values.price * 100),
          scheduled_at: values.scheduled_at || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setServerError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      router.push('/studio/classes')
      router.refresh()
    } catch {
      setServerError('Something went wrong. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg px-4 py-3 text-sm">
          {serverError}
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
        <Input
          id="title"
          placeholder="e.g. The Art of French Pastry"
          {...register('title')}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      {/* Category + Type row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
          <select
            id="category"
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register('category')}
          >
            <option value="">Select category</option>
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
            <option value="">Select type</option>
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
          <option value="">Select skill level</option>
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
          placeholder="What will students learn in this class? Who is it for?"
          rows={5}
          maxLength={2000}
          {...register('description')}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      {/* Price + Channel row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="space-y-1.5">
          <Label htmlFor="channel_id">Channel <span className="text-destructive">*</span></Label>
          <select
            id="channel_id"
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register('channel_id')}
          >
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
          {errors.channel_id && <p className="text-xs text-destructive">{errors.channel_id.message}</p>}
        </div>
      </div>

      {/* Scheduled At — only for live */}
      {classType === 'live' && (
        <div className="space-y-1.5">
          <Label htmlFor="scheduled_at">Scheduled Date & Time</Label>
          <Input
            id="scheduled_at"
            type="datetime-local"
            {...register('scheduled_at')}
          />
          {errors.scheduled_at && <p className="text-xs text-destructive">{errors.scheduled_at.message}</p>}
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Class
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
