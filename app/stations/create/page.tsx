'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Radio, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const ICONS = ['🍕', '🍔', '🌮', '🍜', '🍣', '🍰', '🥗', '🍷', '☕', '🥩', '🫕', '🍛', '🥐', '🍦', '🌶️', '🫙']

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function CreateStationPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📡')
  const [customIcon, setCustomIcon] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeIcon = customIcon || icon

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Station name is required'); return }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=/stations/create'); return }

      const slug = slugify(name)
      const { data, error: insertError } = await supabase
        .from('stations')
        .insert({
          name: name.trim(),
          slug,
          description: description.trim() || null,
          icon: activeIcon,
          cover_url: null,
          follower_count: 0,
          video_count: 0,
        })
        .select('slug')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          setError('A station with that name already exists. Try a different name.')
        } else {
          setError(insertError.message)
        }
        return
      }

      router.push(`/stations/${data.slug}`)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <main className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/stations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Stations
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Radio className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Create a Station</h1>
            <p className="text-muted-foreground text-sm">Build a themed community around a food topic</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Station name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              placeholder="e.g. Street Tacos, Sourdough Bakers, Korean BBQ"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              required
            />
            {name && (
              <p className="text-xs text-muted-foreground">
                URL: <span className="font-mono text-foreground">/stations/{slugify(name) || '...'}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What kind of content belongs here? Who is it for?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={280}
            />
            <p className="text-xs text-muted-foreground">{description.length}/280</p>
          </div>

          {/* Icon picker */}
          <div className="space-y-3">
            <Label>Station icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => { setIcon(em); setCustomIcon('') }}
                  className={`w-10 h-10 rounded-xl text-xl transition-all border-2 ${
                    icon === em && !customIcon
                      ? 'border-primary bg-primary/10 scale-110'
                      : 'border-transparent hover:border-muted-foreground/30 hover:bg-muted'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Or type any emoji 🍄"
                value={customIcon}
                onChange={e => setCustomIcon(e.target.value)}
                className="w-40 font-mono"
                maxLength={4}
              />
              {customIcon && (
                <span className="text-2xl">{customIcon}</span>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl bg-muted/50 border flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-card border-2 border-border flex items-center justify-center text-3xl">
              {activeIcon}
            </div>
            <div>
              <p className="font-bold">{name || 'Your Station Name'}</p>
              <p className="text-sm text-muted-foreground line-clamp-1">{description || 'Your description...'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">0 followers · 0 videos</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Station'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/stations">Cancel</Link>
            </Button>
          </div>
        </form>
      </main>
    </AppShell>
  )
}
