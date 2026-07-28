'use client'

import { useState } from 'react'
import { Trophy, Clock, Zap, Users, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface Challenge {
  id: string
  title: string
  description: string | null
  theme: string | null
  cover_image_url: string | null
  start_date: string
  end_date: string
  voting_start_date: string | null
  voting_end_date: string | null
  voting_type: string
  token_vote_cost: number
  status: string
  prize_cash_cents: number
  prize_tokens: number
  prize_badge: string | null
  prize_homepage_feature: boolean
  max_entries_per_creator: number | null
  rules: string | null
}

interface Entry {
  id: string
  title: string
  description: string | null
  entry_url: string | null
  status: string
  vote_count: number
  created_at: string
  creator: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null
}

interface Props {
  challenge: Challenge
  entries: Entry[]
  user: { id: string; isCreator: boolean } | null
  userEntry: { id: string; status: string } | null
  userVotes: string[]
}

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  voting: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  judging: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  complete: 'bg-muted text-muted-foreground border-border',
}

export default function ChallengeDetailClient({ challenge, entries, user, userEntry, userVotes: initialVotes }: Props) {
  const [votes, setVotes] = useState<string[]>(initialVotes)
  const [entryList, setEntryList] = useState<Entry[]>(entries)
  const [votingEntry, setVotingEntry] = useState<string | null>(null)
  const [entering, setEntering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [entryData, setEntryData] = useState({ title: '', description: '', entry_url: '' })

  const canVote = ['voting', 'active'].includes(challenge.status) && !!user
  const canEnter = challenge.status === 'active' && !!user?.isCreator && !userEntry

  async function voteForEntry(entryId: string) {
    if (!canVote || votes.includes(entryId)) return
    setVotingEntry(entryId)
    setError(null)
    try {
      const res = await fetch(`/api/challenges/${challenge.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entryId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Vote failed')
      setVotes(v => [...v, entryId])
      setEntryList(list =>
        list.map(e => e.id === entryId ? { ...e, vote_count: e.vote_count + 1 } : e)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed')
    } finally {
      setVotingEntry(null)
    }
  }

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault()
    setEntering(true)
    setError(null)
    try {
      const res = await fetch(`/api/challenges/${challenge.id}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Entry failed')
      setSuccess('Entry submitted! Good luck 🎉')
      setShowEntryForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Entry failed')
    } finally {
      setEntering(false)
    }
  }

  const prizeStr = challenge.prize_cash_cents > 0
    ? `$${(challenge.prize_cash_cents / 100).toFixed(0)} cash prize`
    : challenge.prize_tokens > 0
      ? `${challenge.prize_tokens.toLocaleString()} Hapi Tokens`
      : challenge.prize_badge
        ? `"${challenge.prize_badge}" badge`
        : 'Homepage Feature'

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-8">
      {/* Back */}
      <Link href="/challenges" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> All Challenges
      </Link>

      {/* Header */}
      {challenge.cover_image_url && (
        <div className="aspect-[21/7] bg-muted rounded-2xl overflow-hidden mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={challenge.cover_image_url} alt={challenge.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[challenge.status] ?? ''}`}>
              {challenge.status}
            </span>
            {challenge.theme && (
              <span className="text-[10px] text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                {challenge.theme}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold">{challenge.title}</h1>
          {challenge.description && <p className="text-muted-foreground mt-1 text-sm">{challenge.description}</p>}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 text-center shrink-0">
          <div className="text-lg font-black text-primary">{prizeStr}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Trophy className="h-3 w-3" /> Prize
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-sm font-bold">{new Date(challenge.end_date).toLocaleDateString()}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Clock className="h-3 w-3" /> Deadline</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-sm font-bold">{entryList.length}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Users className="h-3 w-3" /> Entries</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-sm font-bold capitalize">{challenge.voting_type}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Zap className="h-3 w-3" /> Voting</div>
        </div>
      </div>

      {/* Rules */}
      {challenge.rules && (
        <div className="bg-card border border-border rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold mb-2">Rules</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{challenge.rules}</p>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{success}
        </div>
      )}

      {/* Enter CTA */}
      {canEnter && !showEntryForm && (
        <div className="mb-8 bg-primary/10 border border-primary/30 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">Enter this Challenge</div>
              <div className="text-sm text-muted-foreground mt-0.5">Submit your video and compete for the prize.</div>
            </div>
            <button
              onClick={() => setShowEntryForm(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0"
            >
              Enter Now
            </button>
          </div>
        </div>
      )}

      {userEntry && (
        <div className="mb-8 bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
          <span className="text-sm text-green-400 font-medium">Your entry is submitted and under review.</span>
        </div>
      )}

      {/* Entry form */}
      {showEntryForm && (
        <form onSubmit={submitEntry} className="mb-8 bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Submit Your Entry</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Entry Title *</label>
              <input
                required
                value={entryData.title}
                onChange={e => setEntryData(d => ({ ...d, title: e.target.value }))}
                placeholder="What's your dish or video called?"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Video URL *</label>
              <input
                required
                type="url"
                value={entryData.entry_url}
                onChange={e => setEntryData(d => ({ ...d, entry_url: e.target.value }))}
                placeholder="Link to your HapiEats video"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Description (optional)</label>
              <textarea
                rows={3}
                value={entryData.description}
                onChange={e => setEntryData(d => ({ ...d, description: e.target.value }))}
                placeholder="Tell voters about your entry…"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={entering}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {entering ? 'Submitting…' : 'Submit Entry'}
              </button>
              <button
                type="button"
                onClick={() => setShowEntryForm(false)}
                className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Entries */}
      <div>
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Entries
          <span className="text-muted-foreground font-normal text-sm">({entryList.length})</span>
        </h2>

        {entryList.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p>No entries yet. Be the first to enter!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entryList.map((entry, idx) => {
              const hasVoted = votes.includes(entry.id)
              const isVoting = votingEntry === entry.id
              const voteButtonVisible = canVote && !hasVoted && entry.creator?.id !== user?.id

              return (
                <div key={entry.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
                  {/* Rank */}
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' : idx === 1 ? 'bg-zinc-400/20 text-zinc-400' : idx === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-muted text-muted-foreground'}`}>
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm">
                          {entry.entry_url ? (
                            <a href={entry.entry_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                              {entry.title}
                            </a>
                          ) : entry.title}
                        </div>
                        {entry.creator && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            @{entry.creator.username ?? entry.creator.display_name ?? 'creator'}
                          </div>
                        )}
                        {entry.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{entry.description}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="text-sm font-bold tabular-nums">{entry.vote_count} <span className="text-xs font-normal text-muted-foreground">votes</span></div>
                        {voteButtonVisible ? (
                          <button
                            onClick={() => voteForEntry(entry.id)}
                            disabled={isVoting}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                          >
                            {challenge.voting_type === 'token' && <Zap className="h-3 w-3" />}
                            {isVoting ? '…' : challenge.voting_type === 'token' ? `Vote (${challenge.token_vote_cost})` : 'Vote'}
                          </button>
                        ) : hasVoted ? (
                          <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Voted
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!user && canVote && (
          <p className="mt-4 text-sm text-center text-muted-foreground">
            <Link href="/login?redirect=/challenges" className="text-primary hover:underline">Sign in</Link> to vote.
          </p>
        )}
      </div>
    </div>
  )
}
