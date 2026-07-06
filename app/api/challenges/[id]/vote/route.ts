import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  // Deduct tokens if needed
  if (finalTokensSpent > 0) {
    const { data: wallet } = await service.from('hapi_tokens').select('balance').eq('user_id', user.id).single()
    if (!wallet || wallet.balance < finalTokensSpent) {
      return NextResponse.json({ error: 'Insufficient tokens', balance: wallet?.balance ?? 0 }, { status: 402 })
    }

    const { error: debitErr } = await service.rpc('record_token_movement', {
      p_user_id: user.id,
      p_type: 'challenge_vote',
      p_amount: -finalTokensSpent,
      p_description: `Voted on challenge entry`,
      p_metadata: { challenge_id: params.id, entry_id },
    })
    if (debitErr) {
    if (debitErr.message?.includes('INSUFFICIENT_BALANCE')) {
      return NextResponse.json({ error: 'Insufficient tokens' }, { status: 402 })
    }
    return NextResponse.json({ error: 'Failed to deduct tokens' }, { status: 500 })
  }
  }

  // Record the vote (upsert to prevent double voting)
  const { data: vote, error: voteErr } = await service.from('challenge_votes').upsert({
    entry_id,
    voter_id: user.id,
    tokens_spent: finalTokensSpent,
  }, { onConflict: 'entry_id,voter_id', ignoreDuplicates: true }).select().single()

  if (voteErr) {
    return NextResponse.json({ error: voteErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, vote, tokens_spent: finalTokensSpent })
}
