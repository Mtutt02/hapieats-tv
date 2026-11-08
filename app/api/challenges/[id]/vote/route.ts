import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { paymentsPausedResponse } from '@/lib/payments-pause'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entry_id, tokens_to_spend = 0 } = await req.json()
  if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 })

  const service = createServiceClient()

  // Verify challenge is in voting
  const { data: challenge } = await service
    .from('creator_challenges')
    .select('id, status, voting_type, token_vote_cost')
    .eq('id', params.id)
    .single()

  if (!challenge || challenge.status !== 'voting') {
    return NextResponse.json({ error: 'Challenge is not in voting phase' }, { status: 400 })
  }

  // Verify entry belongs to this challenge and is approved
  const { data: entry } = await service
    .from('challenge_entries')
    .select('id, creator_id, challenge_id')
    .eq('id', entry_id)
    .eq('challenge_id', params.id)
    .eq('status', 'approved')
    .single()

  if (!entry) return NextResponse.json({ error: 'Entry not found or not approved' }, { status: 404 })
  if (entry.creator_id === user.id) return NextResponse.json({ error: 'Cannot vote on your own entry' }, { status: 400 })

  // Determine token cost
  let finalTokensSpent = 0
  if (challenge.voting_type === 'token' || challenge.voting_type === 'hybrid') {
    finalTokensSpent = Math.max(tokens_to_spend, challenge.token_vote_cost ?? 0)
  }

  // Paid vote: the debit and the vote row are ONE transaction (cast_paid_vote). The wallet
  // row is locked, the vote is inserted under the unique key (entry_id, voter_id), and tokens
  // are debited only if that insert happened - so a double tap or a retry charges once.
  if (finalTokensSpent > 0) {
    // Spending purchased tokens follows the purchase pause (like goal contributions).
    // Free votes are not payments and keep working.
    const paused = paymentsPausedResponse()
    if (paused) return paused

    const { data: cast, error: castErr } = await service.rpc('cast_paid_vote', {
      p_user_id: user.id,
      p_challenge_id: params.id,
      p_entry_id: entry_id,
      p_cost: finalTokensSpent,
    })
    if (castErr) {
      if (castErr.message?.includes('INSUFFICIENT_BALANCE')) {
        const { data: wallet } = await service.from('hapi_tokens').select('balance').eq('user_id', user.id).limit(1)
        return NextResponse.json({ error: 'Insufficient tokens', balance: wallet?.[0]?.balance ?? 0 }, { status: 402 })
      }
      if (castErr.message?.includes('ENTRY_NOT_VOTABLE')) {
        return NextResponse.json({ error: 'Entry not found or not approved' }, { status: 404 })
      }
      console.error('[challenges/vote] cast_paid_vote failed:', castErr)
      return NextResponse.json({ error: 'Could not record your vote' }, { status: 500 })
    }
    if (cast?.status === 'duplicate') {
      // Already voted on this entry: nothing was charged.
      return NextResponse.json({ success: true, duplicate: true, tokens_spent: 0 })
    }
    return NextResponse.json({ success: true, vote: { id: cast?.vote_id, entry_id, voter_id: user.id, tokens_spent: finalTokensSpent }, tokens_spent: finalTokensSpent })
  }

  // Free vote (upsert to prevent double voting)
  const { data: voteRows, error: voteErr } = await service.from('challenge_votes').upsert({
    entry_id,
    voter_id: user.id,
    tokens_spent: 0,
  }, { onConflict: 'entry_id,voter_id', ignoreDuplicates: true }).select()

  if (voteErr) {
    return NextResponse.json({ error: voteErr.message }, { status: 500 })
  }
  if (!voteRows || voteRows.length === 0) {
    return NextResponse.json({ success: true, duplicate: true, tokens_spent: 0 })
  }

  return NextResponse.json({ success: true, vote: voteRows[0], tokens_spent: 0 })
}
