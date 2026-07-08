import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import UploadStudio from '@/components/upload/UploadStudio'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Upload Video',
  description: 'Upload a new food video to your HapiEats TV channel.',
}

interface PageProps {
  searchParams: { stationId?: string; mode?: string }
}

export default async function UploadPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/studio/upload')

  const [{ data: channels }, { data: profile }] = await Promise.all([
    supabase.from('channels').select('id, name, slug').eq('creator_id', user.id),
    supabase.from('profiles').select('is_creator').eq('id', user.id).single(),
  ])

  let preselectedStation: { id: string; name: string } | null = null
  if (searchParams.stationId) {
    const service = createServiceClient()
    const { data: station } = await service
      .from('stations')
      .select('id, name')
      .eq('id', searchParams.stationId)
      .single()
    preselectedStation = station ?? null
  }

  return (
    <AppShell>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Link
          href="/studio"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Creator Studio
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Upload Video</h1>
          <p className="text-zinc-400 mt-1.5">
            Upload, trim, and publish directly to your channel or the main feed.
          </p>
        </div>

        <UploadStudio
          channels={channels ?? []}
          preselectedStation={preselectedStation}
          isCreator={profile?.is_creator ?? false}
        />
      </main>
    </AppShell>
  )
}
