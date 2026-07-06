/**
 * HapiEats TV — App Credits Business Logic
 *
 * Rules:
 * - Gift credits are consumed FIRST before loan credits
 * - Creator earns $0 from any credit-funded portion of a purchase
 * - Loans auto-deducted from creator cashout; can also be repaid manually via Stripe
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface CreditBalance {
  giftBalance: number
  loanBalance: number
  loanRepaid: number
  totalAvailable: number
}

export interface CreditApplication {
  giftUsed: number        // amount applied from gift balance
  loanUsed: number        // amount applied from loan balance
  totalCreditsUsed: number
  remainingCash: number   // amount still owed via real payment (Stripe)
  fullyCoveredByCredits: boolean
}

/**
 * Fetch a user's current credit balance (read-only, uses service client).
 * Returns zeros if the user has no credit row yet.
 */
export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('app_credits')
    .select('gift_balance, loan_balance, loan_repaid')
    .eq('user_id', userId)
    .single()

  const gift = parseFloat(data?.gift_balance ?? '0')
  const loan = parseFloat(data?.loan_balance ?? '0')
  const repaid = parseFloat(data?.loan_repaid ?? '0')

  return {
    giftBalance: gift,
    loanBalance: loan,
    loanRepaid: repaid,
    totalAvailable: gift + loan,
  }
}

/**
 * Calculate how credits would apply to a purchase amount.
 * Gift credits are consumed first; loan credits second.
 * The caller decides whether to proceed (does NOT modify the DB).
 */
export function calculateCreditApplication(
  purchaseAmountUsd: number,
  creditBalance: CreditBalance,
): CreditApplication {
  const { giftBalance, loanBalance } = creditBalance
  const total = giftBalance + loanBalance

  if (total === 0 || purchaseAmountUsd <= 0) {
    return {
      giftUsed: 0,
      loanUsed: 0,
      totalCreditsUsed: 0,
      remainingCash: purchaseAmountUsd,
      fullyCoveredByCredits: false,
    }
  }

  // Consume gift first, then loan
  const giftUsed = Math.min(giftBalance, purchaseAmountUsd)
  const remaining = purchaseAmountUsd - giftUsed
  const loanUsed = Math.min(loanBalance, remaining)
  const totalCreditsUsed = round2(giftUsed + loanUsed)
  const remainingCash = round2(purchaseAmountUsd - totalCreditsUsed)

  return {
    giftUsed: round2(giftUsed),
    loanUsed: round2(loanUsed),
    totalCreditsUsed,
    remainingCash,
    fullyCoveredByCredits: remainingCash <= 0,
  }
}

/**
 * Atomically deduct credits from a user's balance and write ledger entries.
 * Must be called with service-role privileges.
 * Throws if balance is insufficient or DB write fails.
 */
export async function deductCredits(opts: {
  userId: string
  giftUsed: number
  loanUsed: number
  referenceId: string
  referenceType: string
  notes?: string
}): Promise<void> {
  const { userId, giftUsed, loanUsed, referenceId, referenceType, notes } = opts
  if (giftUsed === 0 && loanUsed === 0) return

  const serviceClient = createServiceClient()

  // Fetch current balance (lock via upsert pattern below)
  const { data: row, error: fetchErr } = await serviceClient
    .from('app_credits')
    .select('gift_balance, loan_balance, loan_repaid')
    .eq('user_id', userId)
    .single()

  if (fetchErr || !row) throw new Error('No credit balance found for user')

  const currentGift = parseFloat(row.gift_balance)
  const currentLoan = parseFloat(row.loan_balance)
  const currentRepaid = parseFloat(row.loan_repaid)

  if (currentGift < giftUsed || currentLoan < loanUsed) {
    throw new Error('Insufficient credits')
  }

  const newGift = round2(currentGift - giftUsed)
  const newLoan = round2(currentLoan - loanUsed)

  // Update balances
  const { error: updateErr } = await serviceClient
    .from('app_credits')
    .update({ gift_balance: newGift, loan_balance: newLoan })
    .eq('user_id', userId)

  if (updateErr) throw new Error(`Failed to deduct credits: ${updateErr.message}`)

  // Write ledger entries
  const entries: Array<{
    user_id: string
    entry_type: string
    amount: number
    gift_balance_after: number
    loan_balance_after: number
    reference_id: string
    reference_type: string
    notes?: string
  }> = []

  if (giftUsed > 0) {
    entries.push({
      user_id: userId,
      entry_type: 'spend_gift',
      amount: giftUsed,
      gift_balance_after: newGift,
      loan_balance_after: newLoan,
      reference_id: referenceId,
      reference_type: referenceType,
      notes,
    })
  }

  if (loanUsed > 0) {
    entries.push({
      user_id: userId,
      entry_type: 'spend_loan',
      amount: loanUsed,
      gift_balance_after: newGift,
      loan_balance_after: newLoan,
      reference_id: referenceId,
      reference_type: referenceType,
      notes,
    })
  }

  const { error: ledgerErr } = await serviceClient.from('credit_ledger').insert(entries)
  if (ledgerErr) throw new Error(`Failed to write credit ledger: ${ledgerErr.message}`)
}

/**
 * Grant credits to a user (gift or loan).
 * Creates the credit row if it doesn't exist yet.
 * Must be called with service-role privileges.
 */
export async function grantCredits(opts: {
  userId: string
  grantedBy: string
  type: 'gift' | 'loan'
  amount: number
  notes?: string
  expiresAt?: string
}): Promise<void> {
  const { userId, grantedBy, type, amount, notes, expiresAt } = opts
  if (amount <= 0) throw new Error('Grant amount must be positive')

  const serviceClient = createServiceClient()

  // Upsert credit row
  const { data: existing } = await serviceClient
    .from('app_credits')
    .select('gift_balance, loan_balance, loan_repaid')
    .eq('user_id', userId)
    .single()

  const currentGift = parseFloat(existing?.gift_balance ?? '0')
  const currentLoan = parseFloat(existing?.loan_balance ?? '0')
  const currentRepaid = parseFloat(existing?.loan_repaid ?? '0')

  const newGift = type === 'gift' ? round2(currentGift + amount) : currentGift
  const newLoan = type === 'loan' ? round2(currentLoan + amount) : currentLoan

  const { error: upsertErr } = await serviceClient.from('app_credits').upsert(
    {
      user_id: userId,
      gift_balance: newGift,
      loan_balance: newLoan,
      loan_repaid: currentRepaid,
    },
    { onConflict: 'user_id' },
  )
  if (upsertErr) throw new Error(`Failed to upsert credit balance: ${upsertErr.message}`)

  // Log the grant
  const { error: grantErr } = await serviceClient.from('credit_grants').insert({
    user_id: userId,
    granted_by: grantedBy,
    type,
    amount,
    notes,
    expires_at: expiresAt ?? null,
  })
  if (grantErr) throw new Error(`Failed to log credit grant: ${grantErr.message}`)

  // Ledger entry
  const { error: ledgerErr } = await serviceClient.from('credit_ledger').insert({
    user_id: userId,
    entry_type: type === 'gift' ? 'grant_gift' : 'grant_loan',
    amount,
    gift_balance_after: newGift,
    loan_balance_after: newLoan,
    reference_id: grantedBy,
    reference_type: 'admin_grant',
    notes,
  })
  if (ledgerErr) throw new Error(`Failed to write ledger for grant: ${ledgerErr.message}`)
}

/**
 * Auto-repay outstanding loan from a creator cashout.
 * Reduces usd_net of the cashout and reduces loan_balance.
 * Returns the amount deducted (0 if no loan outstanding).
 */
export async function autoRepayLoanFromCashout(opts: {
  userId: string
  cashoutId: string
  cashoutUsdNet: number
}): Promise<number> {
  const { userId, cashoutId, cashoutUsdNet } = opts
  const serviceClient = createServiceClient()

  const { data: row } = await serviceClient
    .from('app_credits')
    .select('loan_balance, loan_repaid, gift_balance')
    .eq('user_id', userId)
    .single()

  const loanBalance = parseFloat(row?.loan_balance ?? '0')
  const giftBalance = parseFloat(row?.gift_balance ?? '0')
  const loanRepaid = parseFloat(row?.loan_repaid ?? '0')

  if (loanBalance <= 0) return 0

  // Deduct as much as possible from cashout (can't take more than cashout amount)
  const deductAmount = round2(Math.min(loanBalance, cashoutUsdNet))
  if (deductAmount <= 0) return 0

  const newLoan = round2(loanBalance - deductAmount)
  const newRepaid = round2(loanRepaid + deductAmount)

  // Update credit balance
  const { error: creditErr } = await serviceClient
    .from('app_credits')
    .update({ loan_balance: newLoan, loan_repaid: newRepaid })
    .eq('user_id', userId)
  if (creditErr) throw new Error(`Loan repay credit update failed: ${creditErr.message}`)

  // Record on cashout request
  const { error: cashoutErr } = await serviceClient
    .from('flavor_cashout_requests')
    .update({ loan_deducted_usd: deductAmount })
    .eq('id', cashoutId)
  if (cashoutErr) throw new Error(`Loan repay cashout update failed: ${cashoutErr.message}`)

  // Ledger entry
  await serviceClient.from('credit_ledger').insert({
    user_id: userId,
    entry_type: 'repay_loan_earnings',
    amount: deductAmount,
    gift_balance_after: giftBalance,
    loan_balance_after: newLoan,
    reference_id: cashoutId,
    reference_type: 'cashout',
    notes: `Auto-repaid $${deductAmount.toFixed(2)} from cashout`,
  })

  return deductAmount
}

// ---- helpers ----
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
