import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  UploadCloud, Film, BarChart2, Settings, Radio, GraduationCap,
  Eye, DollarSign, Users, TrendingUp, ArrowRight, Wand2, Play, Clock,
} from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Creator Studio',
  description: 'Upload videos, go live, and manage your HapiEats TV channel.',
}

export default async function StudioHomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/studio')

  const { data: channel } = await supabase
    .from('channels')
    .select('id, name, subscriber_count')
    .eq('creator_id', user.id)
    .single()

  if (!channel) redirect('/studio/channel/new')

  // Fetch stats in parallel
  const [videosRes, profileRes, recentRes] = await Promise.all([
    supabase
      .from('videos')
      .select('id, title, status, view_count, created_at', { count: 'exact' })
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('profiles')
      .select('is_creator, display_name, avatar_url')
      .eq('id', user.id)
      .single(),
    supabase
      .from('videos')
      .select('view_count')
      .eq('creator_id', user.id),
  ])

  const totalVideos = videosRes.count ?? 0
  const recentVideos = videosRes.data ?? []
  const profile = profileRes.data
  const totalViews = (recentRes.data ?? []).reduce((s, v) => s + (v.view_count ?? 0), 0)
  const subscribers = channel.subscriber_count ?? 0

  function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-zinc-950">
        {/* ── Top bar ───────────────────────────────────────────────────── */}
        <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center">
                <Wand2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="font-semibold text-sm">Creator Studio</span>
              <span className="hidden sm:block text-zinc-600">·</span>
              <span className="hidden sm:block text-sm text-zinc-400 truncate max-w-[200px]">
                {profile?.display_name ?? channel.name ?? 'My Channel'}
              </span>
            </div>
            <Link href="/studio/upload">
              <Button size="sm" className="gap-1.5 text-sm">
                <UploadCloud className="h-4 w-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            </Link>
            <Link href="/studio/editor">
              <Button size="sm" variant="outline" className="gap-1.5 text-sm border-primary/30 text-primary hover:bg-primary/10">
                <span className="hidden sm:inline">Editor</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">

          {/* ── Stats row ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Videos',   value: fmt(totalVideos),  icon: Film,      color: 'text-blue-400',   bg: 'bg-blue-500/10' },
              { label: 'Total Views',    value: fmt(totalViews),   icon: Eye,       color: 'text-green-400',  bg: 'bg-green-500/10' },
              { label: 'Subscribers',    value: fmt(subscribers),  icon: Users,     color: 'text-purple-400', bg: 'bg-purple-500/10' },
              { label: 'This Month',     value: '—',               icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex items-center gap-4">
                <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-none">{value}</p>
                  <p className="text-xs text-zinc-500 mt-1">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Main grid ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">

            {/* Left: Quick actions + recent videos */}
            <div className="space-y-8">

              {/* Quick actions */}
              <section>
                <h2 className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                  <Link
                    href="/studio/upload"
                    className="group relative flex flex-col gap-3 p-5 rounded-2xl border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-all"
                  >
                    <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <UploadCloud className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Upload Video</p>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-snug">Add a video to your channel</p>
                    </div>
                    <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-primary/40 group-hover:text-primary transition-colors" />
                  </Link>

                  <Link
                    href="/studio/editor"
                    className="group relative flex flex-col gap-3 p-5 rounded-2xl border border-zinc-800 hover:border-primary/50 hover:bg-zinc-900/80 transition-all"
                  >
                    <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <Wand2 className="h-5 w-5 text-zinc-400 group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">TV Studio Editor</p>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-snug">Multi-track editing, keyframes & AI tools</p>
                    </div>
                    <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-zinc-700 group-hover:text-primary/60 transition-colors" />
                  </Link>

                  <Link
                    href="/studio/go-live"
                    className="group relative flex flex-col gap-3 p-5 rounded-2xl border border-zinc-800 hover:border-red-500/40 hover:bg-red-950/20 transition-all"
                  >
                    <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <Radio className="h-5 w-5 text-zinc-400 group-hover:text-red-400 transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Go Live</p>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-snug">Start a live stream now</p>
                    </div>
                    <span className="absolute top-3 right-3 text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-1.5 py-0.5">LIVE</span>
                    <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-zinc-700 group-hover:text-red-400/60 transition-colors" />
                  </Link>

                  <Link
                    href="/studio/classes/new"
                    className="group relative flex flex-col gap-3 p-5 rounded-2xl border border-zinc-800 hover:border-primary/50 hover:bg-zinc-900/80 transition-all"
                  >
                    <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <GraduationCap className="h-5 w-5 text-zinc-400 group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">New Class</p>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-snug">Teach a cooking class</p>
                    </div>
                    <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-zinc-700 group-hover:text-primary/60 transition-colors" />
                  </Link>

                  <Link
                    href="/dashboard"
                    className="group relative flex flex-col gap-3 p-5 rounded-2xl border border-zinc-800 hover:border-primary/50 hover:bg-zinc-900/80 transition-all"
                  >
                    <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <BarChart2 className="h-5 w-5 text-zinc-400 group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Analytics</p>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-snug">Views, revenue & subscribers</p>
                    </div>
                    <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-zinc-700 group-hover:text-primary/60 transition-colors" />
                  </Link>

                  <Link
                    href="/dashboard/settings"
                    className="group relative flex flex-col gap-3 p-5 rounded-2xl border border-zinc-800 hover:border-primary/50 hover:bg-zinc-900/80 transition-all"
                  >
                    <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <Settings className="h-5 w-5 text-zinc-400 group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Channel Settings</p>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-snug">Branding & monetization</p>
                    </div>
                    <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-zinc-700 group-hover:text-primary/60 transition-colors" />
                  </Link>
                </div>
              </section>

              {/* Recent Videos */}
              {recentVideos.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Recent Videos</h2>
                    <Link href="/studio/videos" className="text-xs text-primary hover:underline flex items-center gap-1">
                      See all <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
                    {recentVideos.map((v) => (
                      <div key={v.id} className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-900/60 transition-colors">
                        <div className="h-9 w-9 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                          <Play className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{v.title}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              v.status === 'ready'      ? 'bg-green-500/15 text-green-400' :
                              v.status === 'uploading'  ? 'bg-blue-500/15 text-blue-400' :
                              v.status === 'processing' ? 'bg-amber-500/15 text-amber-400' :
                                                          'bg-zinc-700 text-zinc-400'
                            }`}>
                              {v.status === 'ready' ? '● Live' : v.status === 'uploading' ? '⬆ Uploading' : v.status === 'processing' ? '⟳ Processing' : v.status}
                            </span>
                            <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                              <Eye className="h-2.5 w-2.5" /> {fmt(v.view_count ?? 0)}
                            </span>
                          </div>
                        </div>
                        <Link href={`/studio/videos/${v.id}/edit`} className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800 flex-shrink-0">
                          Edit
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right sidebar: tips & links */}
            <div className="space-y-4">

              {/* Monetization card */}
              {!profile?.is_creator && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-semibold text-amber-300">Unlock Monetization</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Apply for Creator status to earn from Pay-Per-View, subscriptions, and tips.
                  </p>
                  <Link href="/creator/chef-verification">
                    <Button size="sm" variant="outline" className="w-full text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
                      Apply Now
                    </Button>
                  </Link>
                </div>
              )}

              {/* Content guide */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Studio Guide
                </h3>
                <div className="space-y-3">
                  {[
                    { icon: UploadCloud, label: 'Upload a video', href: '/studio/upload', done: totalVideos > 0 },
                    { icon: Wand2,       label: 'Try the TV Studio editor', href: '/studio/editor', done: false },
                    { icon: Radio,       label: 'Go live for the first time', href: '/studio/go-live', done: false },
                    { icon: GraduationCap, label: 'Create a cooking class', href: '/studio/classes/new', done: false },
                    { icon: DollarSign,  label: 'Set up monetization', href: '/creator/chef-verification', done: !!profile?.is_creator },
                  ].map(({ icon: Icon, label, href, done }) => (
                    <Link key={label} href={href} className="flex items-center gap-3 group">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-500/20' : 'bg-zinc-800 group-hover:bg-primary/20'} transition-colors`}>
                        {done
                          ? <span className="text-green-400 text-xs">✓</span>
                          : <Icon className="h-3 w-3 text-zinc-500 group-hover:text-primary transition-colors" />}
                      </div>
                      <span className={`text-xs ${done ? 'text-zinc-600 line-through' : 'text-zinc-400 group-hover:text-zinc-200'} transition-colors`}>
                        {label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Manage links */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-1">
                {[
                  { label: 'All Videos',       href: '/studio/videos',       icon: Film },
                  { label: 'Classes',           href: '/studio/classes',      icon: GraduationCap },
                  { label: 'Analytics',         href: '/dashboard',           icon: BarChart2 },
                  { label: 'Channel Settings',  href: '/dashboard/settings',  icon: Settings },
                ].map(({ label, href, icon: Icon }) => (
                  <Link
                    key={label}
                    href={href}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-800 transition-colors group"
                  >
                    <Icon className="h-3.5 w-3.5 text-zinc-500 group-hover:text-primary transition-colors" />
                    <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">{label}</span>
                    <ArrowRight className="h-3 w-3 text-zinc-700 group-hover:text-zinc-400 ml-auto transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
