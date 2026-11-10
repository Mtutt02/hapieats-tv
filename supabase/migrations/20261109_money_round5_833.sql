-- ============================================================
-- HapiEats TV — Money round 5 (#833, Fable review of 2026-11-09)
--
-- Apply AFTER 20261107_money_fixes_833.sql. Re-runnable: DROP POLICY IF EXISTS /
-- CREATE OR REPLACE / IF NOT EXISTS throughout, nothing is deleted, no data is changed.
--
--   1. P0  Signed-in users could write their own money rows straight through
--          PostgREST (hapi_tokens, creator_wallets, creator_streaks, challenge_votes,
--          goal_contributions, program_enrollments, and the tally columns of
--          challenge_entries / creator_goals). Write policies are removed and the
--          INSERT / UPDATE / DELETE table privileges are revoked from anon and
--          authenticated. Money moves only through the SECURITY DEFINER functions
--          (service_role only, search_path pinned), which keep working because they
--          run as the table owner.
--   2. P1  Partial-credit PPV: a payment confirmation that failed once could let the
--          sweeper / the buyer's next tap RESTORE the credits, and then Stripe's retry
--          delivered the video too. credit_checkout_outcomes is now the single state
--          machine row per checkout ref: restore and fulfil take the same lock, and
--          whichever runs second sees the first (fulfil after restore re-debits).
--   3. P4  Payout request: one function, wallet row locked FOR UPDATE, so two
--          concurrent requests cannot both pass.
--
-- PRODUCTION PRE-CHECKS (read-only; run before applying, see HANDOFF.md ROUND 5):
--   select tablename, policyname, cmd from pg_policies where schemaname='public'
--     and tablename in ('hapi_tokens','creator_wallets','creator_streaks','challenge_votes',
--                       'goal_contributions','program_enrollments','challenge_entries','creator_goals');
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid in ('public.token_ledger'::regclass,'public.credit_ledger'::regclass) and contype='c';
-- ============================================================

-- ── 1. P0: no direct writes to money tables ─────────────────────────────

-- Wallet: the owner may READ it; nothing else.
DROP POLICY IF EXISTS "hapi_tokens_own" ON public.hapi_tokens;
DROP POLICY IF EXISTS "hapi_tokens_own_read" ON public.hapi_tokens;
CREATE POLICY "hapi_tokens_own_read" ON public.hapi_tokens FOR SELECT USING (user_id = auth.uid());

-- 20260703_security_patches.sql dropped creator_wallets_public, so the FOR ALL policy was the only read path
-- (the mobile studio tab reads it with the user's own client): replace it with a SELECT-only one.
DROP POLICY IF EXISTS "creator_wallets_own" ON public.creator_wallets;
DROP POLICY IF EXISTS "creator_wallets_own_read" ON public.creator_wallets;
CREATE POLICY "creator_wallets_own_read" ON public.creator_wallets FOR SELECT USING (creator_id = auth.uid());
-- streaks_public (FOR SELECT USING true) already covers reads.
DROP POLICY IF EXISTS "streaks_own" ON public.creator_streaks;
-- Votes and goal contributions are written only by cast_paid_vote / the contribute route (service role).
DROP POLICY IF EXISTS "votes_own" ON public.challenge_votes;
DROP POLICY IF EXISTS "contributions_insert" ON public.goal_contributions;

-- Belt and braces: even if someone later adds a permissive policy, the role has no privilege to write.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.hapi_tokens, public.creator_wallets, public.creator_streaks,
  public.challenge_votes, public.goal_contributions
  FROM anon, authenticated;

-- Tables a creator legitimately edits: keep the safe columns, take the tally / state columns away
-- (vote_count, token_vote_total, final_rank, status, current_tokens ... are written by triggers and RPCs).
REVOKE INSERT, UPDATE ON public.challenge_entries FROM anon, authenticated;
GRANT INSERT (challenge_id, creator_id, video_id, title, description) ON public.challenge_entries TO authenticated;
GRANT UPDATE (video_id, title, description) ON public.challenge_entries TO authenticated;

REVOKE INSERT, UPDATE ON public.creator_goals FROM anon, authenticated;
GRANT INSERT (creator_id, title, description, target_tokens, deadline, reward_description, cover_image_url)
  ON public.creator_goals TO authenticated;
GRANT UPDATE (title, description, deadline, reward_description, cover_image_url, updated_at)
  ON public.creator_goals TO authenticated;

-- Program enrolments: a user may enrol THEMSELF in a published FREE program (the app route does this with
-- the user's own client) and read/leave their own enrolment. Paid enrolments are written by the Stripe
-- webhook (service role) only. (The academy tables are made by 20260711_academy.sql, which this repo's
-- test database cannot apply, hence the guard.)
DO $$
BEGIN
  IF to_regclass('public.program_enrollments') IS NOT NULL AND to_regclass('public.programs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "program_enroll_own" ON public.program_enrollments;
    DROP POLICY IF EXISTS "program_enroll_own_read" ON public.program_enrollments;
    DROP POLICY IF EXISTS "program_enroll_own_leave" ON public.program_enrollments;
    DROP POLICY IF EXISTS "program_enroll_free_insert" ON public.program_enrollments;
    CREATE POLICY "program_enroll_own_read" ON public.program_enrollments FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "program_enroll_own_leave" ON public.program_enrollments FOR DELETE USING (auth.uid() = user_id);
    CREATE POLICY "program_enroll_free_insert" ON public.program_enrollments FOR INSERT WITH CHECK (
      auth.uid() = user_id
      AND status = 'active'
      AND completed_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.programs p
         WHERE p.id = program_id AND p.is_published AND COALESCE(p.price, 0) <= 0
      )
    );
    REVOKE UPDATE, TRUNCATE ON public.program_enrollments FROM anon, authenticated;
    REVOKE INSERT, DELETE ON public.program_enrollments FROM anon;
  END IF;
END $$;

-- The trigger functions that keep the tallies run as the table owner (SECURITY DEFINER) but never pinned
-- a search_path. Pin it (same body, no behaviour change).
ALTER FUNCTION public.on_goal_contribution_check_complete() SET search_path = public, pg_temp;
ALTER FUNCTION public.on_challenge_vote_inserted() SET search_path = public, pg_temp;
ALTER FUNCTION public.on_profile_created_create_wallet() SET search_path = public, pg_temp;

-- ── 2. P1: one state machine row per partial-credit checkout ────────────
-- 'restored'               the credits were handed back (expired / failed / abandoned / swept)
-- 'fulfilled'              the buyer paid and received the video; credits stay spent
-- 'fulfilled_after_restore' the buyer paid AFTER their credits were handed back: video delivered,
--                           credits taken again (any part they no longer have -> money_exceptions)
-- Restore and fulfil both take the advisory lock for the ref and read/write this row, so exactly
-- one of "credits back" / "video delivered" can win outright; the other either becomes a no-op
-- (restore after fulfil) or repairs the books (fulfil after restore).
CREATE TABLE IF NOT EXISTS public.credit_checkout_outcomes (
  checkout_ref TEXT PRIMARY KEY,
  buyer_id     UUID,
  video_id     UUID,
  outcome      TEXT NOT NULL CHECK (outcome IN ('restored', 'fulfilled', 'fulfilled_after_restore')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_checkout_outcomes ENABLE ROW LEVEL SECURITY; -- service role only
REVOKE ALL ON public.credit_checkout_outcomes FROM anon, authenticated;

-- restore_credits_once: unchanged contract (same signature, one restore per key), plus: a key shaped
-- credit-checkout:<ref>:restore refuses (returns FALSE, moves nothing) once the checkout was fulfilled,
-- and records the 'restored' state when it does restore.
CREATE OR REPLACE FUNCTION public.restore_credits_once(
  p_key     TEXT,
  p_user_id UUID,
  p_gift    NUMERIC,
  p_loan    NUMERIC,
  p_ref     TEXT,
  p_notes   TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n    INT;
  v_gift NUMERIC;
  v_loan NUMERIC;
  v_ref  TEXT := substring(p_key from '^credit-checkout:(.+):restore$');
  v_out  TEXT;
BEGIN
  IF COALESCE(p_gift, 0) < 0 OR COALESCE(p_loan, 0) < 0 OR COALESCE(p_gift, 0) + COALESCE(p_loan, 0) <= 0 THEN
    RAISE EXCEPTION 'restore_credits_once: amounts must be positive';
  END IF;

  IF v_ref IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('credit-checkout:' || v_ref, 0));
    SELECT outcome INTO v_out FROM public.credit_checkout_outcomes WHERE checkout_ref = v_ref;
    IF v_out IN ('fulfilled', 'fulfilled_after_restore') THEN
      RETURN FALSE; -- the buyer paid and has the video: the credits stay spent
    END IF;
  END IF;

  INSERT INTO public.money_effects (effect_key, kind) VALUES (p_key, 'credit_restore')
  ON CONFLICT (effect_key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.app_credits (user_id, gift_balance, loan_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.app_credits
     SET gift_balance = round(gift_balance + COALESCE(p_gift, 0), 2),
         loan_balance = round(loan_balance + COALESCE(p_loan, 0), 2)
   WHERE user_id = p_user_id
  RETURNING gift_balance, loan_balance INTO v_gift, v_loan;

  INSERT INTO public.credit_ledger (
    user_id, entry_type, amount, gift_balance_after, loan_balance_after,
    reference_id, reference_type, notes
  ) VALUES (
    p_user_id, 'restore_credit', COALESCE(p_gift, 0) + COALESCE(p_loan, 0), v_gift, v_loan,
    p_ref, 'checkout_restore', p_notes
  );

  IF v_ref IS NOT NULL THEN
    INSERT INTO public.credit_checkout_outcomes (checkout_ref, buyer_id, outcome)
    VALUES (v_ref, p_user_id, 'restored')
    ON CONFLICT (checkout_ref) DO NOTHING;
  END IF;

  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_credits_once(TEXT, UUID, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_credits_once(TEXT, UUID, NUMERIC, NUMERIC, TEXT, TEXT) TO service_role;

-- settle_credit_checkout: report what actually happened. 'restored' only when this call really gave the
-- credits back; 'already_settled' when the restore had been done (or refused because it was fulfilled).
CREATE OR REPLACE FUNCTION public.settle_credit_checkout(p_buyer UUID, p_video UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row   public.pending_credit_checkouts%ROWTYPE;
  v_owned BOOLEAN;
  v_spent BOOLEAN;
  v_done  BOOLEAN;
BEGIN
  SELECT * INTO v_row FROM public.pending_credit_checkouts
   WHERE buyer_id = p_buyer AND video_id = p_video FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'none';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.purchases WHERE buyer_id = p_buyer AND video_id = p_video) INTO v_owned;
  SELECT EXISTS (
    SELECT 1 FROM public.credit_ledger
     WHERE user_id = p_buyer AND reference_type = 'ppv' AND reference_id = p_video::text
       AND entry_type IN ('spend_gift', 'spend_loan') AND created_at >= v_row.created_at
  ) INTO v_spent;

  DELETE FROM public.pending_credit_checkouts WHERE buyer_id = p_buyer AND video_id = p_video;

  IF v_owned THEN
    RETURN 'owned';
  END IF;
  IF NOT v_spent OR v_row.gift_used + v_row.loan_used <= 0 THEN
    RETURN 'not_debited';
  END IF;

  v_done := public.restore_credits_once(
    'credit-checkout:' || v_row.checkout_ref || ':restore', p_buyer, v_row.gift_used, v_row.loan_used,
    v_row.checkout_ref, 'Credits returned: abandoned checkout');
  RETURN CASE WHEN v_done THEN 'restored' ELSE 'already_settled' END;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_credit_checkout(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_credit_checkout(UUID, UUID) TO service_role;

-- fulfil_credit_ppv: the paid half. Purchase row, state row and claim release in ONE transaction.
-- Returns {status: 'fulfilled' | 'fulfilled_after_restore' | 'already', redebited_gift, redebited_loan, shortfall}.
CREATE OR REPLACE FUNCTION public.fulfil_credit_ppv(
  p_buyer          UUID,
  p_video          UUID,
  p_ref            TEXT,
  p_gift           NUMERIC,
  p_loan           NUMERIC,
  p_payment_intent TEXT,
  p_amount_cents   BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_out      TEXT;
  v_restored BOOLEAN;
  v_gift_bal NUMERIC;
  v_loan_bal NUMERIC;
  v_dg       NUMERIC := 0;
  v_dl       NUMERIC := 0;
  v_short    NUMERIC := 0;
  v_gift_after NUMERIC;
  v_loan_after NUMERIC;
BEGIN
  IF p_ref IS NULL OR p_ref = '' THEN
    RAISE EXCEPTION 'fulfil_credit_ppv: checkout ref required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('credit-checkout:' || p_ref, 0));

  SELECT outcome INTO v_out FROM public.credit_checkout_outcomes WHERE checkout_ref = p_ref;

  -- the video is delivered in every case: the cash part was paid
  INSERT INTO public.purchases (buyer_id, video_id, stripe_payment_intent_id, amount, credit_funded)
  SELECT p_buyer, p_video, p_payment_intent, p_amount_cents, TRUE
   WHERE NOT EXISTS (SELECT 1 FROM public.purchases WHERE buyer_id = p_buyer AND video_id = p_video);

  DELETE FROM public.pending_credit_checkouts
   WHERE buyer_id = p_buyer AND video_id = p_video AND checkout_ref = p_ref;

  IF v_out IN ('fulfilled', 'fulfilled_after_restore') THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  -- were the credits already handed back? (state row, or a restore made before this function existed)
  v_restored := v_out = 'restored' OR EXISTS (
    SELECT 1 FROM public.money_effects WHERE effect_key = 'credit-checkout:' || p_ref || ':restore');

  IF v_restored AND COALESCE(p_gift, 0) + COALESCE(p_loan, 0) > 0 THEN
    -- Take the credits again. Whatever the buyer no longer has cannot be taken: a review row says how much.
    INSERT INTO public.app_credits (user_id, gift_balance, loan_balance)
    VALUES (p_buyer, 0, 0) ON CONFLICT (user_id) DO NOTHING;
    SELECT gift_balance, loan_balance INTO v_gift_bal, v_loan_bal
      FROM public.app_credits WHERE user_id = p_buyer FOR UPDATE;
    v_dg := LEAST(COALESCE(p_gift, 0), v_gift_bal);
    v_dl := LEAST(COALESCE(p_loan, 0), v_loan_bal);
    v_short := (COALESCE(p_gift, 0) - v_dg) + (COALESCE(p_loan, 0) - v_dl);
    UPDATE public.app_credits
       SET gift_balance = round(gift_balance - v_dg, 2), loan_balance = round(loan_balance - v_dl, 2)
     WHERE user_id = p_buyer
    RETURNING gift_balance, loan_balance INTO v_gift_after, v_loan_after;
    IF v_dg > 0 THEN
      INSERT INTO public.credit_ledger (user_id, entry_type, amount, gift_balance_after, loan_balance_after,
                                        reference_id, reference_type, notes)
      VALUES (p_buyer, 'spend_gift', v_dg, v_gift_after, v_loan_after, p_video::text, 'ppv',
              'Credits taken again: checkout paid after its credits were returned (' || p_ref || ')');
    END IF;
    IF v_dl > 0 THEN
      INSERT INTO public.credit_ledger (user_id, entry_type, amount, gift_balance_after, loan_balance_after,
                                        reference_id, reference_type, notes)
      VALUES (p_buyer, 'spend_loan', v_dl, v_gift_after, v_loan_after, p_video::text, 'ppv',
              'Credits taken again: checkout paid after its credits were returned (' || p_ref || ')');
    END IF;
    IF v_short > 0 THEN
      INSERT INTO public.money_exceptions (dedupe_key, kind, user_id, ref, amount, detail)
      VALUES ('restored-then-paid:' || p_ref, 'restored_then_paid', p_buyer, p_ref, v_short,
              jsonb_build_object('video_id', p_video, 'gift_used', p_gift, 'loan_used', p_loan,
                                 'retaken_gift', v_dg, 'retaken_loan', v_dl))
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.credit_checkout_outcomes (checkout_ref, buyer_id, video_id, outcome)
  VALUES (p_ref, p_buyer, p_video, CASE WHEN v_restored THEN 'fulfilled_after_restore' ELSE 'fulfilled' END)
  ON CONFLICT (checkout_ref) DO UPDATE
    SET outcome = EXCLUDED.outcome, video_id = EXCLUDED.video_id, updated_at = now();

  RETURN jsonb_build_object(
    'status', CASE WHEN v_restored THEN 'fulfilled_after_restore' ELSE 'fulfilled' END,
    'redebited_gift', v_dg, 'redebited_loan', v_dl, 'shortfall', v_short);
END;
$$;
REVOKE ALL ON FUNCTION public.fulfil_credit_ppv(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfil_credit_ppv(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, BIGINT) TO service_role;

-- ── 3. P4: creator payout request, atomic ───────────────────────────────
-- The route used to read the wallet, check it, then write it back: two concurrent requests both read
-- the same balance and both passed. Now the wallet row is locked for the whole decision.
-- Returns {status: 'ok' | 'not_found' | 'pending' | 'insufficient' | 'stripe_required', available?}.
CREATE OR REPLACE FUNCTION public.request_creator_payout(p_creator UUID, p_amount_cents INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_w public.creator_wallets%ROWTYPE;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents < 100 THEN
    RAISE EXCEPTION 'request_creator_payout: minimum payout is 100 cents';
  END IF;

  SELECT * INTO v_w FROM public.creator_wallets WHERE creator_id = p_creator FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_w.payout_status = 'pending' THEN
    RETURN jsonb_build_object('status', 'pending');
  END IF;
  IF v_w.redeemable_cents < p_amount_cents THEN
    RETURN jsonb_build_object('status', 'insufficient', 'available', v_w.redeemable_cents);
  END IF;
  IF v_w.stripe_connect_id IS NULL OR v_w.stripe_connect_id = '' THEN
    RETURN jsonb_build_object('status', 'stripe_required');
  END IF;

  UPDATE public.creator_wallets
     SET payout_status = 'pending',
         redeemable_cents = redeemable_cents - p_amount_cents,
         updated_at = now()
   WHERE creator_id = p_creator;

  INSERT INTO public.token_ledger (user_id, type, amount, balance_after, description, metadata)
  VALUES (p_creator, 'adjustment', 0, 0,
          'Payout requested: $' || to_char(p_amount_cents / 100.0, 'FM999999990.00'),
          jsonb_build_object('type', 'payout_request', 'amount_cents', p_amount_cents));

  RETURN jsonb_build_object('status', 'ok', 'amount_cents', p_amount_cents);
END;
$$;
REVOKE ALL ON FUNCTION public.request_creator_payout(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_creator_payout(UUID, INT) TO service_role;
