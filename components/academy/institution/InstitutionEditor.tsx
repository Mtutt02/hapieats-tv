'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FONT_STACKS, sanitizeTheme } from '@/lib/academy/theme'
import ThemedShell from './ThemedShell'

interface Institution {
  slug: string
  name: string
  tagline?: string | null
  about?: string | null
  logo_url?: string | null
  cover_url?: string | null
  accreditation_body?: string | null
  theme?: unknown
}

const FONT_OPTIONS = Object.keys(FONT_STACKS)

/** Owner-only branding + theme editor. PATCHes /api/academy/institutions/[slug]. */
export default function InstitutionEditor({ institution }: { institution: Institution }) {
  const startTheme = sanitizeTheme(institution.theme)
  const [name, setName] = useState(institution.name ?? '')
  const [tagline, setTagline] = useState(institution.tagline ?? '')
  const [about, setAbout] = useState(institution.about ?? '')
  const [logoUrl, setLogoUrl] = useState(institution.logo_url ?? '')
  const [coverUrl, setCoverUrl] = useState(institution.cover_url ?? '')
  const [accreditation, setAccreditation] = useState(institution.accreditation_body ?? '')
  const [primary, setPrimary] = useState(startTheme.primary)
  const [accent, setAccent] = useState(startTheme.accent)
  const [font, setFont] = useState(startTheme.font)

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const theme = { primary, accent, font }

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/academy/institutions/${institution.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          tagline,
          about,
          logo_url: logoUrl,
          cover_url: coverUrl,
          accreditation_body: accreditation,
          theme,
        }),
      })
      const data = await res.json()
      setMsg(res.ok ? 'Saved' : data.error || 'Save failed')
    } catch {
      setMsg('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Branding</h2>
        <div className="space-y-2">
          <Label>School name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label>Tagline</Label>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label>About</Label>
          <Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={5} maxLength={5000} />
        </div>
        <div className="space-y-2">
          <Label>Logo URL</Label>
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="space-y-2">
          <Label>Cover image URL</Label>
          <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="space-y-2">
          <Label>Accreditation body</Label>
          <Input value={accreditation} onChange={(e) => setAccreditation(e.target.value)} maxLength={200} />
        </div>

        <h2 className="pt-2 text-lg font-semibold">Theme</h2>
        <div className="flex gap-4">
          <div className="space-y-2">
            <Label>Primary</Label>
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-16 rounded border" />
          </div>
          <div className="space-y-2">
            <Label>Accent</Label>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-16 rounded border" />
          </div>
          <div className="space-y-2">
            <Label>Font</Label>
            <select
              value={font}
              onChange={(e) => setFont(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </div>

      {/* Live preview */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Preview</h2>
        <ThemedShell theme={theme} className="overflow-hidden rounded-xl border">
          <div className="h-24 w-full bg-[var(--brand-primary)]" />
          <div className="space-y-2 p-5">
            <div className="text-xl font-bold text-[var(--brand-primary)]">{name || 'Your School'}</div>
            <div className="text-sm text-muted-foreground">{tagline || 'Your tagline appears here'}</div>
            <button className="mt-3 rounded-md bg-[var(--brand-accent)] px-4 py-2 text-sm font-medium text-white">
              Enroll now
            </button>
          </div>
        </ThemedShell>
      </div>
    </div>
  )
}
