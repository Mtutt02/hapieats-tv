'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Channel } from '@/types'

const schema = z.object({
  name: z
    .string()
    .min(2, 'Channel name must be at least 2 characters')
    .max(80, 'Channel name must be 80 characters or fewer'),
  description: z
    .string()
    .optional()
    .or(z.literal('')),
  subscription_price: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === '') return true
        const num = parseFloat(val)
        return !isNaN(num) && num >= 0.99
      },
      { message: 'Subscription price must be at least $0.99' }
    ),
})

type FormValues = z.infer<typeof schema>

interface ChannelSettingsFormProps {
  channel: Channel
}

export default function ChannelSettingsForm({ channel }: ChannelSettingsFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: channel.name ?? '',
      description: channel.description ?? '',
      subscription_price: channel.subscription_price != null
        ? String(channel.subscription_price)
        : '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setStatus('loading')
    setErrorMessage('')

    const payload: Record<string, unknown> = {
      name: values.name,
      description: values.description || null,
    }

    if (values.subscription_price && values.subscription_price.trim() !== '') {
      payload.subscription_price = parseFloat(values.subscription_price)
    } else {
      payload.subscription_price = null
    }

    try {
      const res = await fetch('/api/channels/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Failed to update channel.')
        setStatus('error')
        return
      }

      setStatus('success')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setErrorMessage('An unexpected error occurred.')
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="channel_name">Channel Name</Label>
        <Input
          id="channel_name"
          placeholder="My Awesome Channel"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your channel..."
          className="resize-none"
          rows={4}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="subscription_price">Monthly Subscription Price (USD)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            $
          </span>
          <Input
            id="subscription_price"
            type="number"
            step="0.01"
            min="0.99"
            placeholder="4.99"
            className="pl-7"
            {...register('subscription_price')}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Leave blank for a free channel.
        </p>
        {errors.subscription_price && (
          <p className="text-sm text-destructive">{errors.subscription_price.message}</p>
        )}
      </div>

      {status === 'success' && (
        <p className="text-sm text-green-600 font-medium">Channel settings saved successfully.</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      <Button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Saving...' : 'Save Channel Settings'}
      </Button>
    </form>
  )
}
