-- ============================================================
-- HapiEats TV — Money fixes (#833), 2026-11-07
--
-- Safe to run ONCE on production: every statement is IF NOT EXISTS /
-- CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS. Nothing is dropped or
-- rewritten except two CHECK constraints that are widened (all previously
-- valid values stay valid). Existing stripe_events / iap_events rows become
-- status='completed', which is exactly what they meant before.
--
-- PRE-CHECK on production first (read-only). Both CHECK constraints are
-- swapped NOT VALID + VALIDATE and the migration will not abort on unknown
-- legacy values, but you want to know about them:
--   select distinct type       from public.token_ledger;
--   select distinct entry_type from public.credit_ledger;
-- Anything outside the lists in section 2 / section 3 leaves that constraint
-- NOT VALID (still enforced for new rows) and a WARNING is logged.
--
-- APPLY THIS BEFORE deploying the matching code: the new webhook calls the
-- claim_* functions below and returns 500 (Stripe retries) until they exist.
--
-- Sections
--   1. Two-phase webhook event records (stripe_events, iap_events)
--   2. money_effects + "once" fulfilment functions (tokens, flavor, loan repay)
--   3. Credits restore for abandoned partial-credit checkouts
--   4. Pro revenue ledger + atomic payout run
--   5. Atomic live / flavor gifts with request-id dedupe
--   (6-9: round 3 - privileges, manual-review rows, token reversal, course index)
--   10. dispute_won_for_payment            (round 4)
--   11. cast_paid_vote                     (round 4)
--   12. pending_credit_checkouts + claim/peek/settle/release/sweep (round 4)
--   13. update_creator_streak ambiguity fix (round 4)
--   Round 4 also: stripe_events/iap_events status DEFAULT 'completed' re-asserted + first-draft
--   rows repaired (section 1), pro_revenue_ledger.stripe_payment_intent_id + partial unique
--   index and the disputed_cents CHECK (section 4).
-- ============================================================

-- ── 1. Two-phase webhook event records ──────────────────────────────────
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS lease_until  TIMESTAMPTZ;
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS attempts     INT  NOT NULL DEFAULT 0;
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
-- Rows that already exist were claimed under the old scheme: treat as done.
-- The column default STAYS 'completed' on purpose: until the new code is
-- deployed, the old webhook inserts bare {id,type} rows and never completes
-- them. Defaulting those to 'processing' would let the new claim_* re-fulfil
-- them (double credit). claim_stripe_event sets 'processing' explicitly.
-- ADD COLUMN IF NOT EXISTS does not touch an existing column, so a DB that ran the
-- first draft of this migration (default 'processing') keeps that default unless it
-- is set explicitly. SET DEFAULT is idempotent. (#833 round 4, S1)
ALTER TABLE public.stripe_events ALTER COLUMN status SET DEFAULT 'completed';
-- Rows the OLD webhook wrote while that first-draft default was live are 'processing'
-- with no lease and attempts = 0 (claim_stripe_event always sets attempts >= 1 and a
-- lease), so they are not in flight: they were fulfilled by the old code. Mark them
-- completed, otherwise the new claim would treat them as a crashed delivery and
-- re-fulfil them.
UPDATE public.stripe_events SET status = 'completed'
 WHERE status = 'processing' AND lease_until IS NULL AND attempts = 0;

DO $$ BEGIN
  ALTER TABLE public.stripe_events
    ADD CONSTRAINT stripe_events_status_check CHECK (status IN ('processing', 'completed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.iap_events ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.iap_events ADD COLUMN IF NOT EXISTS lease_until  TIMESTAMPTZ;
ALTER TABLE public.iap_events ADD COLUMN IF NOT EXISTS attempts     INT  NOT NULL DEFAULT 0;
ALTER TABLE public.iap_events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
-- (default stays 'completed' here too, same reason; claim_iap_event is explicit)
ALTER TABLE public.iap_events ALTER COLUMN status SET DEFAULT 'completed';
UPDATE public.iap_events SET status = 'completed'
 WHERE status = 'processing' AND lease_until IS NULL AND attempts = 0;

DO $$ BEGIN
  ALTER TABLE public.iap_events
    ADD CONSTRAINT iap_events_status_check CHECK (status IN ('processing', 'completed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- claim_stripe_event: 'claimed' (caller must fulfil), 'duplicate' (already
-- completed) or 'busy' (another delivery holds a live lease). A processing row
-- whose lease has expired is taken over, which is how a crashed delivery heals.
CREATE OR REPLACE FUNCTION public.claim_stripe_event(
  p_id            TEXT,
  p_type          TEXT,
  p_lease_seconds INT DEFAULT 120
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  INSERT INTO public.stripe_events (id, type, status, lease_until, attempts)
  VALUES (p_id, p_type, 'processing', now() + make_interval(secs => p_lease_seconds), 1)
  ON CONFLICT (id) DO UPDATE SET
    status      = 'processing',
    lease_until = now() + make_interval(secs => p_lease_seconds),
    attempts    = public.stripe_events.attempts + 1
  WHERE public.stripe_events.status = 'processing'
    AND (public.stripe_events.lease_until IS NULL OR public.stripe_events.lease_until < now());

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  SELECT status INTO v_status FROM public.stripe_events WHERE id = p_id;
  IF v_status = 'completed' THEN
    RETURN 'duplicate';
  END IF;
  RETURN 'busy';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_stripe_event(p_id TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.stripe_events
     SET status = 'completed', lease_until = NULL, completed_at = now()
   WHERE id = p_id;
$$;

-- Give the lease back after a failed attempt so Stripe's retry runs at once.
CREATE OR REPLACE FUNCTION public.release_stripe_event(p_id TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.stripe_events
     SET lease_until = now()
   WHERE id = p_id AND status = 'processing';
$$;

CREATE OR REPLACE FUNCTION public.claim_iap_event(
  p_event_id      TEXT,
  p_user_id       UUID,
  p_type          TEXT,
  p_product_id    TEXT,
  p_lease_seconds INT DEFAULT 120
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  INSERT INTO public.iap_events (event_id, user_id, type, product_id, status, lease_until, attempts)
  VALUES (p_event_id, p_user_id, p_type, p_product_id, 'processing',
          now() + make_interval(secs => p_lease_seconds), 1)
  ON CONFLICT (event_id) DO UPDATE SET
    status      = 'processing',
    lease_until = now() + make_interval(secs => p_lease_seconds),
    attempts    = public.iap_events.attempts + 1
  WHERE public.iap_events.status = 'processing'
    AND (public.iap_events.lease_until IS NULL OR public.iap_events.lease_until < now());

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  SELECT status INTO v_status FROM public.iap_events WHERE event_id = p_event_id;
  IF v_status = 'completed' THEN
    RETURN 'duplicate';
  END IF;
  RETURN 'busy';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_iap_event(p_event_id TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.iap_events
     SET status = 'completed', lease_until = NULL, completed_at = now()
   WHERE event_id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION public.release_iap_event(p_event_id TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.iap_events
     SET lease_until = now()
   WHERE event_id = p_event_id AND status = 'processing';
$$;

-- ── 2. money_effects + "once" fulfilment functions ──────────────────────
-- One row per money side effect, keyed by something stable that comes from
-- the payment provider (Stripe session / event id, RevenueCat event id).
-- Each function below inserts its key and performs the effect in ONE
-- transaction: either both happen or neither, and a replay is a no-op.
CREATE TABLE IF NOT EXISTS public.money_effects (
  effect_key TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.money_effects ENABLE ROW LEVEL SECURITY; -- service role only

-- token_ledger.type CHECK never allowed 'live_gift' or 'iap_purchase', the
-- two types the live-gift and RevenueCat routes write. Widen it (superset).
-- NOT VALID first (new rows are checked at once, existing rows are not), then
-- VALIDATE in a block that tolerates failure: if production already holds a type
-- outside this list the migration must not abort. See the header pre-checks.
ALTER TABLE public.token_ledger DROP CONSTRAINT IF EXISTS token_ledger_type_check;
ALTER TABLE public.token_ledger ADD CONSTRAINT token_ledger_type_check CHECK (type IN (
  'purchase','gift_sent','gift_received','challenge_vote',
  'creator_goal_contribution','platform_fee','refund',
  'adjustment','circle_pool_distribution','streak_bonus',
  'live_gift','iap_purchase'
)) NOT VALID;
DO $$ BEGIN
  ALTER TABLE public.token_ledger VALIDATE CONSTRAINT token_ledger_type_check;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'money_fixes_833: token_ledger_type_check left NOT VALID (legacy rows outside the list): %', SQLERRM;
END $$;

-- Credit (or, for p_amount < 0, claw back) Hapi Tokens exactly once per key.
-- Returns TRUE when applied, FALSE when the key was already used.
CREATE OR REPLACE FUNCTION public.credit_tokens_once(
  p_key         TEXT,
  p_user_id     UUID,
  p_type        TEXT,
  p_amount      INT,
  p_description TEXT  DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n INT;
BEGIN
  INSERT INTO public.money_effects (effect_key, kind) VALUES (p_key, 'tokens')
  ON CONFLICT (effect_key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RETURN FALSE;
  END IF;

  PERFORM public.record_token_movement(
    p_user_id     := p_user_id,
    p_type        := p_type,
    p_amount      := p_amount,
    p_description := p_description,
    p_metadata    := p_metadata
  );

  -- Keep the legacy token_balances mirror in step (same transaction). The table
  -- may not exist or may differ per environment, so a failure here is ignored.
  IF p_type = 'purchase' AND p_amount > 0 AND to_regclass('public.token_balances') IS NOT NULL THEN
    BEGIN
      EXECUTE 'INSERT INTO public.token_balances (user_id, balance) VALUES ($1, $2)
               ON CONFLICT (user_id) DO UPDATE SET balance = token_balances.balance + EXCLUDED.balance'
        USING p_user_id, p_amount;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN TRUE;
END;
$$;

-- Credit Flavor Points for a Stripe purchase exactly once per key.
CREATE OR REPLACE FUNCTION public.credit_flavor_once(
  p_key        TEXT,
  p_user_id    UUID,
  p_package_id TEXT,
  p_points     INT,
  p_amount_usd NUMERIC,
  p_session_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n INT;
BEGIN
  INSERT INTO public.money_effects (effect_key, kind) VALUES (p_key, 'flavor')
  ON CONFLICT (effect_key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.flavor_wallets (user_id, balance) VALUES (p_user_id, p_points)
  ON CONFLICT (user_id) DO UPDATE SET
    balance    = public.flavor_wallets.balance + EXCLUDED.balance,
    updated_at = now();

  INSERT INTO public.flavor_purchases (user_id, package_id, points_credited, amount_usd, stripe_session_id)
  VALUES (p_user_id, p_package_id, p_points, p_amount_usd, p_session_id);

  RETURN TRUE;
END;
$$;

-- Apply a manual loan repayment exactly once per key. Returns the amount applied.
CREATE OR REPLACE FUNCTION public.repay_loan_once(
  p_key        TEXT,
  p_user_id    UUID,
  p_amount     NUMERIC,
  p_session_id TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n      INT;
  v_gift   NUMERIC;
  v_loan   NUMERIC;
  v_repaid NUMERIC;
  v_actual NUMERIC;
BEGIN
  INSERT INTO public.money_effects (effect_key, kind) VALUES (p_key, 'loan_repay')
  ON CONFLICT (effect_key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RETURN 0;
  END IF;

  SELECT gift_balance, loan_balance, loan_repaid INTO v_gift, v_loan, v_repaid
    FROM public.app_credits WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_actual := LEAST(p_amount, v_loan);
  IF v_actual <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.app_credits
     SET loan_balance = round(v_loan - v_actual, 2),
         loan_repaid  = round(v_repaid + v_actual, 2)
   WHERE user_id = p_user_id;

  INSERT INTO public.credit_ledger (
    user_id, entry_type, amount, gift_balance_after, loan_balance_after,
    reference_id, reference_type, notes
  ) VALUES (
    p_user_id, 'repay_loan_manual', v_actual, v_gift, round(v_loan - v_actual, 2),
    p_session_id, 'stripe_repay', 'Manual repayment via Stripe session ' || p_session_id
  );

  RETURN v_actual;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_event(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_stripe_event(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_stripe_event(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_iap_event(TEXT, UUID, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_iap_event(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_iap_event(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_tokens_once(TEXT, UUID, TEXT, INT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_flavor_once(TEXT, UUID, TEXT, INT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.repay_loan_once(TEXT, UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_stripe_event(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stripe_event(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_iap_event(TEXT, UUID, TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_iap_event(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_iap_event(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_tokens_once(TEXT, UUID, TEXT, INT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_flavor_once(TEXT, UUID, TEXT, INT, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.repay_loan_once(TEXT, UUID, NUMERIC, TEXT) TO service_role;

-- ── 3. Restore credits for an abandoned partial-credit checkout ─────────
-- /api/credits/checkout debits credits BEFORE the Stripe session exists. If the
-- session expires, the async payment fails, or session creation itself fails,
-- the credits must come back — exactly once per key.
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_entry_type_check;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_entry_type_check CHECK (entry_type IN (
  'grant_gift','grant_loan','spend_gift','spend_loan',
  'repay_loan_earnings','repay_loan_manual','expire_gift',
  'restore_credit'
)) NOT VALID;
DO $$ BEGIN
  ALTER TABLE public.credit_ledger VALIDATE CONSTRAINT credit_ledger_entry_type_check;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'money_fixes_833: credit_ledger_entry_type_check left NOT VALID (legacy rows outside the list): %', SQLERRM;
END $$;

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
BEGIN
  IF COALESCE(p_gift, 0) < 0 OR COALESCE(p_loan, 0) < 0 OR COALESCE(p_gift, 0) + COALESCE(p_loan, 0) <= 0 THEN
    RAISE EXCEPTION 'restore_credits_once: amounts must be positive';
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

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_credits_once(TEXT, UUID, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_credits_once(TEXT, UUID, NUMERIC, NUMERIC, TEXT, TEXT) TO service_role;

-- ── 4. Pro revenue ledger + atomic payout run ───────────────────────────
-- The monthly creator pool used to be "active subscribers x list price", an
-- estimate. It is now computed from invoices Stripe actually collected. The
-- webhook (invoice.paid / charge.refunded) writes one row per Pro invoice.
CREATE TABLE IF NOT EXISTS public.pro_revenue_ledger (
  stripe_invoice_id      TEXT PRIMARY KEY,
  user_id                UUID,
  stripe_subscription_id TEXT,
  amount_cents           BIGINT NOT NULL CHECK (amount_cents >= 0), -- collected, excluding tax
  refunded_cents         BIGINT NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  disputed_cents         BIGINT NOT NULL DEFAULT 0 CHECK (disputed_cents >= 0),
  currency               TEXT NOT NULL DEFAULT 'usd',
  paid_at                TIMESTAMPTZ NOT NULL,
  month                  TEXT NOT NULL,                              -- 'YYYY-MM' (UTC) of paid_at
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- (a first run of this migration created the table without disputed_cents)
ALTER TABLE public.pro_revenue_ledger ADD COLUMN IF NOT EXISTS disputed_cents BIGINT NOT NULL DEFAULT 0;
-- ...and that ADD COLUMN carries no CHECK. Add it by name, once (guarded by pg_constraint).
-- NOT VALID + VALIDATE: a legacy negative value must not abort the migration. (#833 round 4, S1)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.pro_revenue_ledger'::regclass
       AND conname = 'pro_revenue_ledger_disputed_cents_check'
  ) THEN
    ALTER TABLE public.pro_revenue_ledger
      ADD CONSTRAINT pro_revenue_ledger_disputed_cents_check CHECK (disputed_cents >= 0) NOT VALID;
    BEGIN
      ALTER TABLE public.pro_revenue_ledger VALIDATE CONSTRAINT pro_revenue_ledger_disputed_cents_check;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'money_fixes_833: pro_revenue_ledger_disputed_cents_check left NOT VALID: %', SQLERRM;
    END;
  END IF;
END $$;
-- Payment intent that paid the invoice: how a refund / dispute finds this row when the charge
-- no longer names its invoice (API version basil). Partial unique: many rows may have none.
-- (#833 round 4, N1/F9)
ALTER TABLE public.pro_revenue_ledger ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_revenue_ledger_payment_intent
  ON public.pro_revenue_ledger (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pro_revenue_ledger_month ON public.pro_revenue_ledger (month);
ALTER TABLE public.pro_revenue_ledger ENABLE ROW LEVEL SECURITY; -- service role only

-- run_pro_payout: the whole distribution is ONE transaction. The pool row is
-- locked, so two concurrent runs serialise; the second sees distributed=true and
-- is a no-op. Every wallet credit and earnings row commits together with the
-- distributed flag, or none of it does. Gross is re-read from the ledger inside
-- the transaction and must equal what the caller used to compute the split.
CREATE OR REPLACE FUNCTION public.run_pro_payout(
  p_month          TEXT,
  p_expected_gross BIGINT,
  p_pool_cents     BIGINT,
  p_total_credits  NUMERIC,
  p_earnings       JSONB  -- [{ "creator_id": uuid, "credits": n, "cents": n }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_distributed BOOLEAN;
  v_gross       BIGINT;
  v_invoices    INT;
  v_split       BIGINT;
  v_paid        BIGINT := 0;
  v_n           INT := 0;
  e             RECORD;
BEGIN
  INSERT INTO public.pro_payout_pool (month) VALUES (p_month)
  ON CONFLICT (month) DO NOTHING;

  SELECT distributed INTO v_distributed
    FROM public.pro_payout_pool WHERE month = p_month FOR UPDATE;
  IF v_distributed THEN
    RETURN jsonb_build_object('status', 'already_distributed');
  END IF;

  SELECT COUNT(*), COALESCE(SUM(GREATEST(amount_cents - refunded_cents - disputed_cents, 0)), 0)
    INTO v_invoices, v_gross
    FROM public.pro_revenue_ledger WHERE month = p_month;

  -- An empty ledger means "nothing recorded", not "nothing earned" (the ledger
  -- starts empty at deploy). Never lock a month on that: leave it undistributed
  -- so a backfill + re-run can still pay it.
  IF v_invoices = 0 THEN
    RETURN jsonb_build_object('status', 'no_invoices');
  END IF;

  IF v_gross <> p_expected_gross THEN
    RAISE EXCEPTION 'GROSS_CHANGED: ledger % vs expected %', v_gross, p_expected_gross;
  END IF;

  -- Defense in depth: never trust the caller's split. SUM(cents) <= pool <= gross.
  SELECT COALESCE(SUM(x.cents), 0) INTO v_split
    FROM jsonb_to_recordset(COALESCE(p_earnings, '[]'::jsonb))
      AS x(creator_id UUID, credits NUMERIC, cents BIGINT);
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(COALESCE(p_earnings, '[]'::jsonb))
      AS x(creator_id UUID, credits NUMERIC, cents BIGINT) WHERE x.cents IS NULL OR x.cents < 0
  ) THEN
    RAISE EXCEPTION 'BAD_SPLIT: negative or missing cents';
  END IF;
  IF p_pool_cents < 0 OR p_pool_cents > v_gross OR v_split > p_pool_cents THEN
    RAISE EXCEPTION 'BAD_SPLIT: split % pool % gross %', v_split, p_pool_cents, v_gross;
  END IF;

  FOR e IN
    SELECT * FROM jsonb_to_recordset(COALESCE(p_earnings, '[]'::jsonb))
      AS x(creator_id UUID, credits NUMERIC, cents BIGINT)
  LOOP
    -- Insert the earnings row as paid; if one already exists and is paid (an old
    -- partial run) leave it alone so that creator is never credited twice.
    INSERT INTO public.pro_pool_earnings (creator_id, month, credits, cents, paid)
    VALUES (e.creator_id, p_month, e.credits, e.cents, TRUE)
    ON CONFLICT (creator_id, month) DO UPDATE
      SET credits = EXCLUDED.credits, cents = EXCLUDED.cents, paid = TRUE
      WHERE public.pro_pool_earnings.paid = FALSE;

    IF FOUND AND e.cents > 0 THEN
      PERFORM public.wallet_add(e.creator_id, 0, e.cents::INT);
      v_paid := v_paid + e.cents;
      v_n := v_n + 1;
    END IF;
  END LOOP;

  UPDATE public.pro_payout_pool
     SET gross_cents    = v_gross,
         pool_cents     = p_pool_cents,
         total_credits  = p_total_credits,
         distributed    = TRUE,
         distributed_at = now()
   WHERE month = p_month;

  RETURN jsonb_build_object(
    'status', 'distributed',
    'creators_paid', v_n,
    'distributed_cents', v_paid,
    'gross_cents', v_gross
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_pro_payout(TEXT, BIGINT, BIGINT, NUMERIC, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_pro_payout(TEXT, BIGINT, BIGINT, NUMERIC, JSONB) TO service_role;

-- ── 5. Atomic gifts with request-id dedupe ──────────────────────────────
-- Sender debit, ledger row, gift transaction, creator wallet credit and circle
-- pool all happen in ONE transaction under a row lock on the sender's wallet.
-- A client-generated request id makes a double-submit (double tap, retry after a
-- timeout) charge exactly once.
ALTER TABLE public.live_gift_transactions ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_gift_tx_request
  ON public.live_gift_transactions (sender_id, request_id) WHERE request_id IS NOT NULL;

ALTER TABLE public.flavor_gift_events ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_flavor_gift_events_request
  ON public.flavor_gift_events (sender_id, request_id) WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.send_live_gift(
  p_request_id TEXT,
  p_sender_id  UUID,
  p_stream_id  UUID,
  p_gift_id    UUID,
  p_quantity   INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stream         RECORD;
  v_gift           RECORD;
  v_balance        INT;
  v_dup            RECORD;
  v_total          INT;
  v_rate           JSONB;
  v_cents_per_tok  NUMERIC;
  v_total_cents    INT;
  v_creator_cents  INT;
  v_platform_cents INT;
  v_circle_cents   INT;
  v_tx_id          UUID;
  v_month          TEXT := to_char(now(), 'YYYY-MM');
  v_new_balance    INT;
BEGIN
  IF p_request_id IS NULL OR length(p_request_id) = 0 THEN
    RAISE EXCEPTION 'REQUEST_ID_REQUIRED';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 10 THEN
    RAISE EXCEPTION 'BAD_QUANTITY';
  END IF;

  SELECT id, creator_id, status, title INTO v_stream FROM public.live_streams WHERE id = p_stream_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'STREAM_NOT_FOUND'; END IF;
  IF v_stream.status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'STREAM_ENDED'; END IF; -- only a live ('active') stream takes gifts
  IF v_stream.creator_id = p_sender_id THEN RAISE EXCEPTION 'OWN_STREAM'; END IF;

  SELECT id, name, emoji, token_cost, creator_pct, platform_pct, circle_pct INTO v_gift
    FROM public.live_gifts WHERE id = p_gift_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'GIFT_UNAVAILABLE'; END IF;

  -- Serialise everything this sender does: lock their wallet row first.
  INSERT INTO public.hapi_tokens (user_id, balance) VALUES (p_sender_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.hapi_tokens WHERE user_id = p_sender_id FOR UPDATE;

  -- Replay of the same request: report the original result, charge nothing.
  SELECT id, total_tokens, creator_earned_cents INTO v_dup
    FROM public.live_gift_transactions
   WHERE sender_id = p_sender_id AND request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'duplicate', 'transaction_id', v_dup.id, 'total_tokens', v_dup.total_tokens,
      'creator_cents', v_dup.creator_earned_cents, 'remaining_balance', v_balance,
      'gift', jsonb_build_object('name', v_gift.name, 'emoji', v_gift.emoji, 'token_cost', v_gift.token_cost),
      'creator_id', v_stream.creator_id, 'stream_title', v_stream.title);
  END IF;

  v_total := v_gift.token_cost * p_quantity;
  IF v_balance < v_total THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: required %, available %', v_total, v_balance USING ERRCODE = 'P0002';
  END IF;

  -- Debit + ledger (record_token_movement re-locks the same row and re-checks the balance).
  PERFORM public.record_token_movement(
    p_user_id      := p_sender_id,
    p_type         := 'live_gift',
    p_amount       := -v_total,
    p_related_user := v_stream.creator_id,
    p_description  := format('Sent %s%s %s on "%s"',
                             CASE WHEN p_quantity > 1 THEN p_quantity::TEXT || 'x ' ELSE '' END,
                             v_gift.emoji, v_gift.name, v_stream.title),
    p_metadata     := jsonb_build_object('stream_id', p_stream_id, 'gift_id', p_gift_id,
                                         'quantity', p_quantity, 'request_id', p_request_id)
  );

  SELECT value INTO v_rate FROM public.platform_settings WHERE key = 'token_conversion_rate';
  v_cents_per_tok  := COALESCE((v_rate ->> 'cents_per_token')::NUMERIC, 1);
  v_total_cents    := round(v_total * v_cents_per_tok);
  v_creator_cents  := floor(v_total_cents * (v_gift.creator_pct  / 100.0));
  v_platform_cents := floor(v_total_cents * (v_gift.platform_pct / 100.0));
  v_circle_cents   := v_total_cents - v_creator_cents - v_platform_cents;

  INSERT INTO public.live_gift_transactions (
    sender_id, recipient_id, stream_id, gift_id, quantity, total_tokens,
    creator_earned_cents, platform_fee_cents, circle_pool_cents, request_id
  ) VALUES (
    p_sender_id, v_stream.creator_id, p_stream_id, p_gift_id, p_quantity, v_total,
    v_creator_cents, v_platform_cents, v_circle_cents, p_request_id
  ) RETURNING id INTO v_tx_id;

  PERFORM public.wallet_add(v_stream.creator_id, v_total, v_creator_cents);

  IF v_circle_cents > 0 THEN
    INSERT INTO public.creator_circle_pool (month, total_cents) VALUES (v_month, v_circle_cents)
    ON CONFLICT (month) DO UPDATE SET total_cents = public.creator_circle_pool.total_cents + EXCLUDED.total_cents;
  END IF;

  SELECT balance INTO v_new_balance FROM public.hapi_tokens WHERE user_id = p_sender_id;

  RETURN jsonb_build_object(
    'status', 'ok', 'transaction_id', v_tx_id, 'total_tokens', v_total,
    'creator_cents', v_creator_cents, 'remaining_balance', v_new_balance,
    'gift', jsonb_build_object('name', v_gift.name, 'emoji', v_gift.emoji, 'token_cost', v_gift.token_cost),
    'creator_id', v_stream.creator_id, 'stream_title', v_stream.title);
END;
$$;

-- Flavor Points gift: debit sender, record the event, credit creator earnings, atomically.
CREATE OR REPLACE FUNCTION public.send_flavor_gift(
  p_request_id    TEXT,
  p_sender_id     UUID,
  p_creator_id    UUID,
  p_stream_id     UUID,
  p_gift_id       TEXT,
  p_points_cost   INT,
  p_creator_share INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance INT;
  v_dup     UUID;
  v_event   UUID;
BEGIN
  IF p_request_id IS NULL OR length(p_request_id) = 0 THEN
    RAISE EXCEPTION 'REQUEST_ID_REQUIRED';
  END IF;
  IF p_points_cost IS NULL OR p_points_cost <= 0 THEN
    RAISE EXCEPTION 'BAD_COST';
  END IF;

  SELECT balance INTO v_balance FROM public.flavor_wallets WHERE user_id = p_sender_id FOR UPDATE;
  IF NOT FOUND THEN v_balance := 0; END IF;

  SELECT id INTO v_dup FROM public.flavor_gift_events
   WHERE sender_id = p_sender_id AND request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'duplicate', 'event_id', v_dup, 'new_balance', v_balance);
  END IF;

  IF v_balance < p_points_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: required %, available %', p_points_cost, v_balance USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.flavor_wallets
     SET balance = balance - p_points_cost, updated_at = now()
   WHERE user_id = p_sender_id;

  INSERT INTO public.flavor_gift_events (stream_id, sender_id, creator_id, gift_id, points_spent, creator_share, request_id)
  VALUES (p_stream_id, p_sender_id, p_creator_id, p_gift_id, p_points_cost, p_creator_share, p_request_id)
  RETURNING id INTO v_event;

  INSERT INTO public.creator_flavor_earnings (creator_id, gift_event_id, points_earned, status)
  VALUES (p_creator_id, v_event, p_creator_share, 'pending');

  RETURN jsonb_build_object('status', 'ok', 'event_id', v_event, 'new_balance', v_balance - p_points_cost);
END;
$$;

REVOKE ALL ON FUNCTION public.send_live_gift(TEXT, UUID, UUID, UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_flavor_gift(TEXT, UUID, UUID, UUID, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_live_gift(TEXT, UUID, UUID, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_flavor_gift(TEXT, UUID, UUID, UUID, TEXT, INT, INT) TO service_role;

-- ── 6. Close the privilege hole on pre-existing money functions (#833-7) ─
-- These SECURITY DEFINER functions were never revoked. Postgres grants EXECUTE
-- to PUBLIC by default and Supabase exposes public functions at /rest/v1/rpc/*,
-- so any signed-in user could call e.g. record_token_movement(self, 'purchase',
-- 1000000) and mint tokens, or approve their own monetization by passing an
-- admin's uuid. Every app caller uses the service-role client, so lock them to
-- service_role and pin search_path. Missing signatures (an environment that
-- never ran one of the older migrations) are skipped, not an error.
DO $$
DECLARE
  v_sig TEXT;
  v_sigs TEXT[] := ARRAY[
    'public.record_token_movement(uuid,text,int,uuid,uuid,uuid,text,jsonb)',
    'public.admin_review_monetization_request(uuid,text,uuid,text)',
    'public.check_monetization_auto_unlock(uuid)',
    'public.ensure_token_wallet(uuid)',
    'public.ensure_creator_wallet(uuid)',
    'public.update_creator_streak(uuid,text)',
    'public.wallet_add(uuid,int,int)',
    'public.bump_course_enrollment(uuid)'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      RAISE NOTICE 'money_fixes_833: % not found, skipped', v_sig;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', v_sig);
  END LOOP;
END $$;

-- ── 7. Manual-review rows for money that could not be settled (#833 F6, F10) ─
-- Anything the code cannot finish by itself (a credit restore that failed, a
-- token clawback where the buyer already spent the tokens) is written HERE, not
-- just to the log, so someone reviewing money can see it. RLS on, no policy:
-- service role only.
CREATE TABLE IF NOT EXISTS public.money_exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key  TEXT UNIQUE,                -- one row per problem, however often it is retried
  kind        TEXT NOT NULL,              -- 'credit_restore_failed' | 'token_clawback_shortfall' | ...
  user_id     UUID,
  ref         TEXT,                       -- stripe session / payment intent / checkout ref
  amount      NUMERIC,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);
CREATE INDEX IF NOT EXISTS idx_money_exceptions_open ON public.money_exceptions (created_at) WHERE resolved_at IS NULL;
ALTER TABLE public.money_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.money_exceptions FROM anon, authenticated;

-- ── 8. Token clawback: one row per PAYMENT, proportional, capped (#833 F2, F10) ─
-- Keyed by payment intent (not by event): a refund + a dispute on one charge, or
-- two partial refunds, are several events for ONE purchase. refund_tokens and
-- dispute_tokens are cumulative targets (absolute, from Stripe's cumulative
-- amounts), so a replay changes nothing; the total reversed can never exceed what
-- was bought. If the buyer already spent some of it, what is available is clawed
-- back and the shortfall goes to money_exceptions.
CREATE TABLE IF NOT EXISTS public.token_reversals (
  effect_key     TEXT PRIMARY KEY,        -- 'stripe:pi:<payment_intent>:token-reversal'
  user_id        UUID NOT NULL,
  purchased      INT  NOT NULL CHECK (purchased > 0),
  refund_tokens  INT  NOT NULL DEFAULT 0 CHECK (refund_tokens >= 0),
  dispute_tokens INT  NOT NULL DEFAULT 0 CHECK (dispute_tokens >= 0),
  reversed       INT  NOT NULL DEFAULT 0 CHECK (reversed >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.token_reversals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.token_reversals FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.reverse_tokens_for_payment(
  p_key           TEXT,
  p_user_id       UUID,
  p_purchased     INT,
  p_source        TEXT,   -- 'refund' | 'dispute'
  p_source_tokens INT,    -- cumulative tokens this source covers (proportional to the amount)
  p_reason        TEXT    DEFAULT NULL,
  p_metadata      JSONB   DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row       public.token_reversals%ROWTYPE;
  v_target    INT;
  v_delta     INT;
  v_balance   INT;
  v_debit     INT;
BEGIN
  IF p_source NOT IN ('refund', 'dispute') THEN
    RAISE EXCEPTION 'reverse_tokens_for_payment: bad source %', p_source;
  END IF;
  IF p_purchased IS NULL OR p_purchased <= 0 THEN
    RAISE EXCEPTION 'reverse_tokens_for_payment: purchased must be positive';
  END IF;

  INSERT INTO public.token_reversals (effect_key, user_id, purchased)
  VALUES (p_key, p_user_id, p_purchased)
  ON CONFLICT (effect_key) DO NOTHING;

  SELECT * INTO v_row FROM public.token_reversals WHERE effect_key = p_key FOR UPDATE;

  IF p_source = 'refund' THEN
    v_row.refund_tokens := GREATEST(v_row.refund_tokens, LEAST(GREATEST(COALESCE(p_source_tokens, 0), 0), v_row.purchased));
  ELSE
    v_row.dispute_tokens := GREATEST(v_row.dispute_tokens, LEAST(GREATEST(COALESCE(p_source_tokens, 0), 0), v_row.purchased));
  END IF;

  v_target := LEAST(v_row.purchased, v_row.refund_tokens + v_row.dispute_tokens);
  v_delta  := v_target - v_row.reversed;

  v_debit := 0;
  IF v_delta > 0 THEN
    -- Lock the wallet, then take what is there (never below zero).
    INSERT INTO public.hapi_tokens (user_id, balance) VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO v_balance FROM public.hapi_tokens WHERE user_id = p_user_id FOR UPDATE;
    v_debit := LEAST(v_delta, GREATEST(v_balance, 0));
    IF v_debit > 0 THEN
      PERFORM public.record_token_movement(
        p_user_id     := p_user_id,
        p_type        := 'refund',
        p_amount      := -v_debit,
        p_description := format('Reversed %s Hapi Tokens (%s)', v_debit, COALESCE(p_reason, p_source)),
        p_metadata    := COALESCE(p_metadata, '{}'::jsonb)
                         || jsonb_build_object('reversal_key', p_key, 'source', p_source,
                                               'cumulative_target', v_target, 'purchased', v_row.purchased)
      );
    END IF;
  END IF;

  UPDATE public.token_reversals
     SET refund_tokens = v_row.refund_tokens, dispute_tokens = v_row.dispute_tokens,
         reversed = reversed + v_debit, updated_at = now()
   WHERE effect_key = p_key;

  IF v_delta > v_debit THEN
    INSERT INTO public.money_exceptions (dedupe_key, kind, user_id, ref, amount, detail)
    VALUES (p_key || ':shortfall', 'token_clawback_shortfall', p_user_id, p_key, v_delta - v_debit,
            jsonb_build_object('purchased', v_row.purchased, 'target', v_target,
                               'reversed', v_row.reversed + v_debit, 'source', p_source))
    ON CONFLICT (dedupe_key) DO UPDATE
      SET amount = EXCLUDED.amount, detail = EXCLUDED.detail, updated_at = now(), resolved_at = NULL;
  ELSE
    UPDATE public.money_exceptions SET resolved_at = now(), updated_at = now()
     WHERE dedupe_key = p_key || ':shortfall' AND resolved_at IS NULL;
  END IF;

  RETURN jsonb_build_object('target', v_target, 'reversed_now', v_debit,
                            'reversed_total', v_row.reversed + v_debit,
                            'shortfall', GREATEST(v_delta - v_debit, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_tokens_for_payment(TEXT, UUID, INT, TEXT, INT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_tokens_for_payment(TEXT, UUID, INT, TEXT, INT, TEXT, JSONB) TO service_role;

-- ── 9. course_enrollments needs a unique (course_id, user_id) (#833 F13) ────
-- The webhook upserts with onConflict 'course_id,user_id'. The table has no
-- CREATE TABLE in the repo (it was made on the dashboard), so only add the index
-- if the table exists and no unique index on exactly those columns is there yet;
-- never fail the migration (duplicates already in the table are reported).
DO $$
BEGIN
  IF to_regclass('public.course_enrollments') IS NULL THEN
    RAISE NOTICE 'money_fixes_833: course_enrollments not found, unique index skipped';
  ELSIF EXISTS (
    SELECT 1 FROM pg_index i
      JOIN pg_attribute a1 ON a1.attrelid = i.indrelid AND a1.attname = 'course_id'
      JOIN pg_attribute a2 ON a2.attrelid = i.indrelid AND a2.attname = 'user_id'
     WHERE i.indrelid = 'public.course_enrollments'::regclass
       AND i.indisunique AND i.indpred IS NULL AND i.indnatts = 2
       AND a1.attnum = ANY (i.indkey::int2[]) AND a2.attnum = ANY (i.indkey::int2[])
  ) THEN
    RAISE NOTICE 'money_fixes_833: unique (course_id, user_id) already present on course_enrollments';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_course_enrollments_course_user
      ON public.course_enrollments (course_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'money_fixes_833: could not create unique (course_id, user_id) on course_enrollments (duplicates?): %', SQLERRM;
END $$;

-- ═══ #833 ROUND 4 ═════════════════════════════════════════════════════════
-- Everything below is idempotent (CREATE ... IF NOT EXISTS / CREATE OR REPLACE).
-- The column/index for pro_revenue_ledger.stripe_payment_intent_id and the S1
-- fixes (status defaults, disputed_cents CHECK) are next to the statements they
-- repair, in sections 1 and 4 above.

-- ── 10. A WON dispute: undo what charge.dispute.created did (#833 S3) ───────
-- The merchant kept the money. The webhook sets pro_revenue_ledger.disputed_cents
-- back to 0 itself; this function does the token side: the dispute share of the
-- cumulative reversal target goes to 0. Tokens that were already clawed back are
-- NOT given back automatically (the buyer may have chargebacked in bad faith, or
-- spent the tokens elsewhere in the meantime): a human decides, via a
-- money_exceptions row 'dispute_won_review'. Idempotent: the row is deduped by key
-- and lowering dispute_tokens to 0 twice changes nothing.
CREATE OR REPLACE FUNCTION public.dispute_won_for_payment(
  p_key        TEXT,   -- 'stripe:pi:<payment_intent>:token-reversal'
  p_dispute_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.token_reversals%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.token_reversals WHERE effect_key = p_key FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'review', false);
  END IF;

  UPDATE public.token_reversals
     SET dispute_tokens = 0, updated_at = now()
   WHERE effect_key = p_key;

  IF v_row.reversed > 0 THEN
    INSERT INTO public.money_exceptions (dedupe_key, kind, user_id, ref, amount, detail)
    VALUES ('dispute-won:' || p_key, 'dispute_won_review', v_row.user_id, p_key, v_row.reversed,
            jsonb_build_object(
              'dispute_id', p_dispute_id,
              'purchased', v_row.purchased,
              'reversed_total', v_row.reversed,
              'refund_tokens', v_row.refund_tokens,
              'dispute_tokens_before', v_row.dispute_tokens,
              'note', 'Dispute WON: tokens already clawed back were not re-credited. Decide whether to give them back.'))
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('found', true, 'review', v_row.reversed > 0, 'reversed', v_row.reversed);
END;
$$;

REVOKE ALL ON FUNCTION public.dispute_won_for_payment(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_won_for_payment(TEXT, TEXT) TO service_role;

-- ── 11. Paid challenge vote: debit and vote in ONE transaction (#833 N3) ────
-- The route used to debit tokens and then insert the vote. A second request for the
-- same entry (double tap, retry) debited again and then failed on the unique key.
-- Here the voter's wallet row is locked first, so concurrent requests queue; the vote
-- is inserted under the existing unique key (entry_id, voter_id); tokens are debited
-- ONLY if that insert actually happened. An insufficient balance raises, which rolls
-- the vote back too.
CREATE OR REPLACE FUNCTION public.cast_paid_vote(
  p_user_id      UUID,
  p_challenge_id UUID,
  p_entry_id     UUID,
  p_cost         INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance INT;
  v_vote_id UUID;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RAISE EXCEPTION 'cast_paid_vote: cost must be positive';
  END IF;

  -- defense in depth: the route checks these too
  IF NOT EXISTS (
    SELECT 1
      FROM public.challenge_entries e
      JOIN public.creator_challenges c ON c.id = e.challenge_id
     WHERE e.id = p_entry_id AND e.challenge_id = p_challenge_id
       AND e.status = 'approved' AND c.status = 'voting' AND e.creator_id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'ENTRY_NOT_VOTABLE';
  END IF;

  INSERT INTO public.hapi_tokens (user_id, balance) VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.hapi_tokens WHERE user_id = p_user_id FOR UPDATE;

  INSERT INTO public.challenge_votes (entry_id, voter_id, tokens_spent)
  VALUES (p_entry_id, p_user_id, p_cost)
  ON CONFLICT (entry_id, voter_id) DO NOTHING
  RETURNING id INTO v_vote_id;

  IF v_vote_id IS NULL THEN
    RETURN jsonb_build_object('status', 'duplicate', 'tokens_spent', 0);
  END IF;

  IF v_balance < p_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: required %, available %', p_cost, v_balance
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.record_token_movement(
    p_user_id     := p_user_id,
    p_type        := 'challenge_vote',
    p_amount      := -p_cost,
    p_description := 'Voted on challenge entry',
    p_metadata    := jsonb_build_object('challenge_id', p_challenge_id, 'entry_id', p_entry_id, 'vote_id', v_vote_id)
  );

  RETURN jsonb_build_object('status', 'voted', 'vote_id', v_vote_id, 'tokens_spent', p_cost);
END;
$$;

REVOKE ALL ON FUNCTION public.cast_paid_vote(UUID, UUID, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_paid_vote(UUID, UUID, UUID, INT) TO service_role;

-- ── 12. One open credit checkout per (buyer, video) (#833 S2, #6 sweeper) ───
-- /api/credits/checkout checked "already owned", then debited, in separate steps: two
-- taps (or two tabs) both passed the check and both debited. The route now claims
-- (buyer_id, video_id) here BEFORE the debit; the primary key makes the second claim
-- lose ('in_progress'). The row is released when the purchase is fulfilled, when the
-- credits are restored, or (crash between the debit and the Stripe session) swept:
-- an expired row is settled the next time that buyer claims, or by
-- sweep_stale_credit_checkouts(). Settling restores the credits under the SAME key the
-- route and webhook use (credit-checkout:<ref>:restore), so it can never restore twice.
CREATE TABLE IF NOT EXISTS public.pending_credit_checkouts (
  buyer_id     UUID NOT NULL,
  video_id     UUID NOT NULL,
  checkout_ref TEXT NOT NULL,
  gift_used    NUMERIC NOT NULL DEFAULT 0,
  loan_used    NUMERIC NOT NULL DEFAULT 0,
  session_url  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (buyer_id, video_id)
);
ALTER TABLE public.pending_credit_checkouts ENABLE ROW LEVEL SECURITY; -- service role only
REVOKE ALL ON public.pending_credit_checkouts FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_pending_credit_checkouts_expires ON public.pending_credit_checkouts (expires_at);

-- Settle one pending row that is past its expiry (or being replaced): give the credits
-- back only if they were really spent for it and the buyer does not own the video, then
-- delete the row. Returns 'restored' | 'owned' | 'not_debited' | 'none'.
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

  PERFORM public.restore_credits_once(
    'credit-checkout:' || v_row.checkout_ref || ':restore', p_buyer, v_row.gift_used, v_row.loan_used,
    v_row.checkout_ref, 'Credits returned: abandoned checkout');
  RETURN 'restored';
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_credit_checkout(
  p_buyer       UUID,
  p_video       UUID,
  p_ref         TEXT,
  p_gift        NUMERIC,
  p_loan        NUMERIC,
  p_ttl_seconds INT DEFAULT 2100   -- longer than the 31 minute Stripe session
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.pending_credit_checkouts%ROWTYPE;
  v_n   INT;
BEGIN
  INSERT INTO public.pending_credit_checkouts (buyer_id, video_id, checkout_ref, gift_used, loan_used, expires_at)
  VALUES (p_buyer, p_video, p_ref, COALESCE(p_gift, 0), COALESCE(p_loan, 0), now() + make_interval(secs => p_ttl_seconds))
  ON CONFLICT (buyer_id, video_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 1 THEN
    RETURN jsonb_build_object('status', 'claimed');
  END IF;

  SELECT * INTO v_row FROM public.pending_credit_checkouts
   WHERE buyer_id = p_buyer AND video_id = p_video FOR UPDATE;
  IF NOT FOUND THEN
    -- released between our insert attempt and the lock: let the caller retry
    RETURN jsonb_build_object('status', 'in_progress');
  END IF;
  IF v_row.expires_at > now() THEN
    RETURN jsonb_build_object('status', 'in_progress', 'session_url', v_row.session_url);
  END IF;

  -- the earlier attempt is past its expiry: give its credits back (if spent), then take over
  PERFORM public.settle_credit_checkout(p_buyer, p_video);
  INSERT INTO public.pending_credit_checkouts (buyer_id, video_id, checkout_ref, gift_used, loan_used, expires_at)
  VALUES (p_buyer, p_video, p_ref, COALESCE(p_gift, 0), COALESCE(p_loan, 0), now() + make_interval(secs => p_ttl_seconds))
  ON CONFLICT (buyer_id, video_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('status', CASE WHEN v_n = 1 THEN 'claimed' ELSE 'in_progress' END);
END;
$$;

-- Read-only-ish look at the pair BEFORE the route computes anything: 'in_progress' when a live
-- checkout holds it (the route answers 409 and hands back the Stripe URL); an EXPIRED row is settled
-- right here (credits restored once if they were spent), which matters because after a crash the
-- buyer has no credits left and would otherwise never get as far as claim_credit_checkout.
CREATE OR REPLACE FUNCTION public.peek_credit_checkout(p_buyer UUID, p_video UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.pending_credit_checkouts%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.pending_credit_checkouts
   WHERE buyer_id = p_buyer AND video_id = p_video FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  IF v_row.expires_at > now() THEN
    RETURN jsonb_build_object('status', 'in_progress', 'session_url', v_row.session_url);
  END IF;
  PERFORM public.settle_credit_checkout(p_buyer, p_video);
  RETURN jsonb_build_object('status', 'none');
END;
$$;

-- Release the claim once the purchase is fulfilled or the credits were restored. Matches
-- on checkout_ref so a late release from an OLD attempt can never clear a newer claim.
CREATE OR REPLACE FUNCTION public.release_credit_checkout(p_buyer UUID, p_video UUID, p_ref TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.pending_credit_checkouts
   WHERE buyer_id = p_buyer AND video_id = p_video AND checkout_ref = p_ref;
  RETURN FOUND;
END;
$$;

-- For a scheduler (NOT scheduled by this migration): settle every expired pending row.
CREATE OR REPLACE FUNCTION public.sweep_stale_credit_checkouts(p_limit INT DEFAULT 100)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_n INT := 0;
BEGIN
  FOR r IN
    SELECT buyer_id, video_id FROM public.pending_credit_checkouts
     WHERE expires_at < now() ORDER BY expires_at LIMIT p_limit
  LOOP
    PERFORM public.settle_credit_checkout(r.buyer_id, r.video_id);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_credit_checkout(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_credit_checkout(UUID, UUID, TEXT, NUMERIC, NUMERIC, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.peek_credit_checkout(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_credit_checkout(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sweep_stale_credit_checkouts(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_credit_checkout(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_credit_checkout(UUID, UUID, TEXT, NUMERIC, NUMERIC, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.peek_credit_checkout(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_credit_checkout(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_stale_credit_checkouts(INT) TO service_role;

-- ── 13. update_creator_streak: "column reference current_streak is ambiguous" (#833 F18, pre-existing) ─
-- RETURNS TABLE(current_streak ...) makes current_streak an OUT variable, which clashes with the
-- creator_streaks.current_streak column inside the body, so the function failed on every call and
-- the streak route that grants bonus tokens depended on it. Same body, resolved with
-- #variable_conflict use_column; search_path pinned; ACL re-asserted (service_role only).
CREATE OR REPLACE FUNCTION public.update_creator_streak(
  p_creator_id    UUID,
  p_activity_type TEXT
)
RETURNS TABLE(current_streak INT, milestone TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_today       DATE := CURRENT_DATE;
  v_last_date   DATE;
  v_curr_streak INT;
  v_longest     INT;
  v_milestone   TEXT := NULL;
BEGIN
  INSERT INTO creator_streaks (creator_id) VALUES (p_creator_id)
  ON CONFLICT (creator_id) DO NOTHING;

  SELECT last_activity_date, current_streak, longest_streak
    INTO v_last_date, v_curr_streak, v_longest
    FROM creator_streaks WHERE creator_id = p_creator_id;

  IF v_last_date IS NULL OR v_last_date < v_today - INTERVAL '1 day' THEN
    v_curr_streak := 1;
  ELSIF v_last_date = v_today - INTERVAL '1 day' THEN
    v_curr_streak := v_curr_streak + 1;
  ELSE
    v_curr_streak := GREATEST(v_curr_streak, 1);
  END IF;

  IF v_curr_streak > v_longest THEN v_longest := v_curr_streak; END IF;

  IF    v_curr_streak >= 90 THEN v_milestone := '90';
  ELSIF v_curr_streak >= 30 THEN v_milestone := '30';
  ELSIF v_curr_streak >= 7  THEN v_milestone := '7';
  END IF;

  UPDATE creator_streaks SET
    current_streak  = v_curr_streak,
    longest_streak  = v_longest,
    last_activity_date = v_today,
    total_posts     = CASE WHEN p_activity_type = 'post'      THEN total_posts + 1      ELSE total_posts      END,
    total_streams   = CASE WHEN p_activity_type = 'stream'    THEN total_streams + 1    ELSE total_streams    END,
    total_challenge_entries = CASE WHEN p_activity_type = 'challenge'
                                   THEN total_challenge_entries + 1 ELSE total_challenge_entries END,
    updated_at = NOW()
  WHERE creator_id = p_creator_id;

  RETURN QUERY SELECT v_curr_streak, v_milestone;
END;
$$;

REVOKE ALL ON FUNCTION public.update_creator_streak(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_creator_streak(UUID, TEXT) TO service_role;
