import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import Link from 'next/link'
import { Trophy, Clock, Users, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Creator Challenges — HapiEats TV' }

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  voting: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  judging: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  complete: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-muted text-muted-foreground border-border',
}

export default async function ChallengesPage() {
  const service = createServiceClient()

  const { data: challenges } = await service
    .from('creator_challenges')
    .select(`
      id, title, description, theme, cover_image_url,
      start_date, end_date, voting_start_date, voting_end_date,
      voting_type, token_vote_cost, status,
      prize_cash_cents, prize_tokens, prize_badge, prize_homepage_feature,
      created_at
    `)
    .neq('status', 'cancelled')
    .order('start_date', { ascending: false })
    .limit(30)

  const active = (challenges ?? []).filter(c => ['active', 'voting'].includes(c.status))
  const upcoming = (challenges ?? []).filter(c => c.status === 'upcoming')
  const past = (challenges ?? []).filter(c => c.status === 'complete')

  function ChallengeCard({ c }: { c: typeof active[0] }) {
    const prizeStr = c.prize_cash_cents > 0
      ? `$${(c.prize_cash_cents / 100).toFixed(0)} cash`
      : c.prize_tokens > 0
        ? `${c.prize_tokens.toLocaleString()} tokens`
        : 'Badge + Feature'

    return (
      <Link href={`/challenges/${c.id}`} className="group block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all">
        {c.cover_image_url && (
          <div className="aspect-[16/7] bg-muted overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.cover_image_url} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status] ?? ''}`}>
              {c.status}
            </span>
            {c.voting_type !== 'free' && (
              <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                <Zap className="h-3 w-3" />
                {c.voting_type === 'token' ? `Token Vote (${c.token_vote_cost})` : 'Hybrid'}
              </span>
            )}
          </div>
          <h3 className="font-bold text-sm group-hover:text-primary transition-colors line-clamp-2">{c.title}</h3>
          {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(c.end_date).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1 text-primary font-semibold">
              <Trophy className="h-3 w-3" />
              {prizeStr}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            Creator Challenges
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Compete, get votes, and win prizes. New challenges every month.
          </p>
        </div>

        {active.length > 0 && (
          <section className="mb-10">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Active Now
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map(c => <ChallengeCard key={c.id} c={c} />)}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="mb-10">
            <h2 className="text-base font-semibold mb-4 text-blue-400">Coming Soon</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map(c => <ChallengeCard key={c.id} c={c} />)}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="text-base font-semibold mb-4 text-muted-foreground">Past Challenges</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {past.map(c => <ChallengeCard key={c.id} c={c} />)}
            </div>
          </section>
        )}

        {(challenges ?? []).length === 0 && (
          <div className="py-20 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground">No challenges yet. Check back soon!</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
