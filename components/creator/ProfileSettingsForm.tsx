'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Profile } from '@/types'

const schema = z.object({
  display_name: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(80, 'Display name must be 80 characters or fewer'),
  bio: z
    .string()
    .max(300, 'Bio must be 300 characters or fewer')
    .optional()
    .or(z.literal('')),
  avatar_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

interface ProfileSettingsFormProps {
  profile: Profile
}

export default function ProfileSettingsForm({ profile }: ProfileSettingsFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: profile.display_name ?? '',
      bio: profile.bio ?? '',
      avatar_url: profile.avatar_url ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setStatus('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: values.display_name,
          bio: values.bio || null,
          avatar_url: values.avatar_url || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Failed to update profile.')
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
        <Label htmlFor="display_name">Display Name</Label>
        <Input
          id="display_name"
          placeholder="Your display name"
          {...register('display_name')}
        />
        {errors.display_name && (
          <p className="text-sm text-destructive">{errors.display_name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          placeholder="Tell viewers a bit about yourself..."
          className="resize-none"
          rows={4}
          {...register('bio')}
        />
        {errors.bio && (
          <p className="text-sm text-destructive">{errors.bio.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="avatar_url">Avatar URL</Label>
        <Input
          id="avatar_url"
          type="url"
          placeholder="https://example.com/avatar.jpg"
          {...register('avatar_url')}
        />
        {errors.avatar_url && (
          <p className="text-sm text-destructive">{errors.avatar_url.message}</p>
        )}
      </div>

      {status === 'success' && (
        <p className="text-sm text-green-600 font-medium">Profile updated successfully.</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      <Button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Saving...' : 'Save Profile'}
      </Button>
    </form>
  )
}
