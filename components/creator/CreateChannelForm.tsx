'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be 50 characters or fewer')
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{3}$/, 'Slug may only contain lowercase letters, numbers, and hyphens')

const schema = z.object({
  name: z
    .string()
    .min(2, 'Channel name must be at least 2 characters')
    .max(80, 'Channel name must be 80 characters or fewer'),
  slug: slugSchema,
  description: z.string().max(500, 'Description must be 500 characters or fewer').optional(),
  subscription_price: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === '') return true
        const n = parseFloat(val)
        return !isNaN(n) && n >= 0.99
      },
      { message: 'Subscription price must be at least $0.99' }
    ),
})

type FormValues = z.infer<typeof schema>

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function CreateChannelForm() {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      subscription_price: '',
    },
  })

  const nameValue = watch('name')

  // Auto-generate slug from name, but only while the user hasn't manually edited it
  useEffect(() => {
    if (!nameValue) return
    const generated = generateSlug(nameValue)
    // Only update slug if it still matches a previously auto-generated value
    // (i.e. derived from the current name prefix). We use setValue without triggering
    // re-validation here — validation fires on blur/submit.
    setValue('slug', generated, { shouldValidate: false })
  }, [nameValue, setValue])

  const onSubmit = async (values: FormValues) => {
    const res = await fetch('/api/channels/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        subscription_price:
          values.subscription_price && values.subscription_price.trim() !== ''
            ? parseFloat(values.subscription_price)
            : undefined,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      if (res.status === 409) {
        setError('slug', { message: data.error })
      } else {
        setError('root', { message: data.error ?? 'Something went wrong. Please try again.' })
      }
      return
    }

    router.push('/studio')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Root-level error */}
      {errors.root && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      {/* Channel Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Channel Name *</Label>
        <Input
          id="name"
          placeholder="Hapi Eats Kitchen"
          autoComplete="off"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="slug">Channel URL Slug *</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">hapieatstv.com/@</span>
          <Input
            id="slug"
            placeholder="hapi-eats-kitchen"
            autoComplete="off"
            {...register('slug')}
          />
        </div>
        {errors.slug ? (
          <p className="text-xs text-destructive">{errors.slug.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and hyphens only — 3 to 50 characters.
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Tell viewers what your channel is about…"
          rows={4}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Subscription Price */}
      <div className="space-y-1.5">
        <Label htmlFor="subscription_price">Monthly Subscription Price (USD)</Label>
        <Input
          id="subscription_price"
          type="number"
          step="0.01"
          min="0.99"
          placeholder="4.99"
          {...register('subscription_price')}
        />
        {errors.subscription_price ? (
          <p className="text-xs text-destructive">{errors.subscription_price.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Monthly subscription price — leave blank for a free channel.
          </p>
        )}
      </div>

      <Button type="submit" className="w-full gap-2" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Creating Channel…' : 'Create Channel'}
      </Button>
    </form>
  )
}
