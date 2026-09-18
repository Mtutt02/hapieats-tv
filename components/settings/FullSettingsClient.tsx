'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckCircle2, User, Lock, Eye, Bell, Trash2, Camera, Loader2 } from 'lucide-react'
import type { Profile } from '@/types'
import ChangePasswordForm from '@/components/settings/ChangePasswordForm'

interface Props {
  profile: Profile
  email: string
}

type Tab = 'profile' | 'privacy' | 'notifications' | 'security' | 'danger'

function SectionCard({ children, title, description }: { children: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6 space-y-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function SaveRow({ loading, saved }: { loading: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Save Changes'}
      </Button>
      {saved && (
        <span className="flex items-center gap-1 text-sm text-green-500">
          <CheckCircle2 className="h-4 w-4" /> Saved
        </span>
      )}
    </div>
  )
}

export default function FullSettingsClient({ profile, email }: Props) {
  const [tab, setTab] = useState<Tab>('profile')

  // Profile state
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [username, setUsername] = useState(profile.username ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Avatar upload state
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // Privacy state
  const [profileVisibility, setProfileVisibility] = useState<string>((profile as any).profile_visibility ?? 'public')
  const [allowComments, setAllowComments] = useState<boolean>((profile as any).allow_comments ?? true)
  const [showInSearch, setShowInSearch] = useState<boolean>((profile as any).show_in_search ?? true)
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const [privacySaved, setPrivacySaved] = useState(false)

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setAvatarError('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Image must be under 5 MB'); return }
    setAvatarError(null)
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/user/avatar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setAvatarUrl(data.avatarUrl)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAvatarUploading(false)
    }
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, username, bio }),
    })
    setProfileLoading(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  const savePrivacy = async (e: React.FormEvent) => {
    e.preventDefault()
    setPrivacyLoading(true)
    await fetch('/api/user/privacy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileVisibility, allowComments, showInSearch }),
    })
    setPrivacyLoading(false)
    setPrivacySaved(true)
    setTimeout(() => setPrivacySaved(false), 2500)
  }

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') { setDeleteError('Type DELETE to confirm'); return }
    setDeleteLoading(true)
    const res = await fetch('/api/user/delete-account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: deleteConfirm }),
    })
    if (res.ok) {
      window.location.href = '/?deleted=1'
    } else {
      const d = await res.json()
      setDeleteError(d.error ?? 'Failed to delete account')
      setDeleteLoading(false)
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'privacy', label: 'Privacy', icon: Eye },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'danger', label: 'Account', icon: Trash2 },
  ]

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Tab nav */}
      <nav className="flex md:flex-col gap-1 md:w-44 shrink-0 overflow-x-auto md:overflow-visible">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          )
        })}
      </nav>

      {/* Tab content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* PROFILE */}
        {tab === 'profile' && (
          <form onSubmit={saveProfile}>
            <SectionCard title="Public Profile" description="This information is visible to other users on HapiEats TV.">
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-primary text-white text-2xl">
                      {displayName.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="avatar-upload"
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                  >
                    {avatarUploading
                      ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                      : <Camera className="h-5 w-5 text-white" />}
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleAvatarChange}
                    disabled={avatarUploading}
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="avatar-upload"
                    className="text-sm font-medium text-primary hover:underline cursor-pointer"
                  >
                    {avatarUploading ? 'Uploading…' : 'Change profile photo'}
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG or GIF · max 5 MB</p>
                  {avatarError && <p className="text-xs text-destructive mt-1">{avatarError}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="mt-1.5"
                    maxLength={50}
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                    <Input
                      id="username"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="pl-7"
                      maxLength={30}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Tell the world about your food journey…"
                  className="mt-1.5 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">{bio.length}/300</p>
              </div>

              <div>
                <Label>Email</Label>
                <Input value={email} disabled className="mt-1.5 opacity-60" />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here.</p>
              </div>

              <SaveRow loading={profileLoading} saved={profileSaved} />
            </SectionCard>
          </form>
        )}

        {/* PRIVACY */}
        {tab === 'privacy' && (
          <form onSubmit={savePrivacy}>
            <SectionCard title="Privacy Settings" description="Control who can see your profile and interact with your content.">
              <div>
                <Label>Profile Visibility</Label>
                <Select value={profileVisibility} onValueChange={setProfileVisibility}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public — anyone can see your profile</SelectItem>
                    <SelectItem value="followers">Followers only</SelectItem>
                    <SelectItem value="private">Private — only you can see your profile</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="font-medium text-sm">Allow comments on my videos</p>
                  <p className="text-xs text-muted-foreground">Viewers can comment on your public videos</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowComments(v => !v)}
                  className={`w-10 h-6 rounded-full transition-colors ${allowComments ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${allowComments ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-sm">Show my profile in search results</p>
                  <p className="text-xs text-muted-foreground">Allow other users to find you by searching your name</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInSearch(v => !v)}
                  className={`w-10 h-6 rounded-full transition-colors ${showInSearch ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${showInSearch ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <SaveRow loading={privacyLoading} saved={privacySaved} />
            </SectionCard>
          </form>
        )}

        {/* NOTIFICATIONS */}
        {tab === 'notifications' && (
          <SectionCard title="Notification Preferences" description="Choose what updates you want to receive.">
            <div className="space-y-4">
              {[
                { label: 'New subscribers', desc: 'When someone subscribes to your channel' },
                { label: 'Comments on your videos', desc: 'When someone comments on your content' },
                { label: 'Gifts and tokens', desc: 'When you receive a gift during a live stream' },
                { label: 'New content from creators I follow', desc: 'When someone you follow uploads a video' },
                { label: 'Platform updates', desc: 'Feature announcements and important changes' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <input type="checkbox" defaultChecked className="accent-primary h-4 w-4" />
                </div>
              ))}
            </div>
            <Button type="button" className="mt-2">Save Preferences</Button>
          </SectionCard>
        )}

        {/* SECURITY */}
        {tab === 'security' && (
          <SectionCard title="Change Password" description="We recommend a unique password of at least 8 characters. You'll need your current password to confirm.">
            <ChangePasswordForm />
          </SectionCard>
        )}

        {/* DANGER ZONE */}
        {tab === 'danger' && (
          <div className="rounded-2xl border border-destructive/30 bg-card p-6">
            <h3 className="font-semibold text-destructive">Delete Account</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              This action permanently removes your account data. Your videos will remain but will be attributed to a deleted user. This cannot be undone.
            </p>

            <div className="space-y-3">
              <Label htmlFor="deleteConfirm">Type <strong>DELETE</strong> to confirm</Label>
              <Input
                id="deleteConfirm"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="border-destructive/40 focus-visible:ring-destructive"
              />
              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}
              <Button
                variant="destructive"
                onClick={deleteAccount}
                disabled={deleteLoading || deleteConfirm !== 'DELETE'}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {deleteLoading ? 'Deleting…' : 'Delete My Account'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
