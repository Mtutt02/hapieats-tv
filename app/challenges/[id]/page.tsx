import { createClient, createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import ChallengeDetailClient from '@/components/challenges/ChallengeDetailClient'
import { redirect, notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const service = createServiceClient()
  const { data } = await service.from('creator_challenges').select('title').eq('id', params.id).single()
  return { title: data?.title ? `${data.title} — HapiEats TV` : 'Challenge — HapiEats TV' }
}

export default async function ChallengeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const service = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: challenge },
    { data: entries },
    { data: profile },
  ] = await Promise.all([
    service
      .from('creator_challenges')
      .select('*')
      .eq('id', params.id)
      .single(),
    service
      .from('challenge_entries')
      .select(`
        id, title, description, entry_url, status, vote_count,
        created_at,
        creator:profiles!challenge_entries_creator_id_fkey(id, username, display_name, avatar_url)
      `)
      .eq('challenge_id', params.id)
      .eq('status', 'submitted')
      .order('vote_count', { ascending: false })
      .limit(50),
    user
      ? supabase.from('profiles').select('is_creator, display_name').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  if (!challenge) notFound()

  // Check if user already entered
  let userEntry: any = null
  let userVotes: string[] = []
  if (user) {
    const [{ data: myEntry }, { data: myVotes }] = await Promise.all([
      service
        .from('challenge_entries')
        .select('id, status')
        .eq('challenge_id', params.id)
        .eq('creator_id', user.id)
        .maybeSingle(),
      service
        .from('challenge_votes')
        .select('entry_id')
        .eq('challenge_id', params.id)
        .eq('voter_id', user.id),
    ])
    userEntry = myEntry
    userVotes = (myVotes ?? []).map((v: any) => v.entry_id)
  }

  return (
    <AppShell>
      <ChallengeDetailClient
        challenge={challenge}
        entries={(entries ?? []) as any[]}
        user={user ? { id: user.id, isCreator: profile?.is_creator ?? false } : null}
        userEntry={userEntry}
        userVotes={userVotes}
      />
    </AppShell>
  )
}
