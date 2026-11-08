-- ============================================================
-- HapiEats TV — Money fixes (#833), 2026-11-07
--
-- Safe to run ONCE on production: every statement is IF NOT EXISTS /
-- CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS. Nothing is dropped or
-- rewritten except two CHECK constraints that are widened (all previously
-- valid values stay valid). Existing stripe_events / iap_events rows become
-- status='completed', which is exactly what they meant before.
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
-- ============================================================

-- ── 1. Two-phase webhook event records ──────────────────────────────────
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS lease_until  TIMESTAMPTZ;
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS attempts     INT  NOT NULL DEFAULT 0;
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
-- Rows that already exist were claimed under the old scheme: treat as done.
-- New rows start life as 'processing'.
ALTER TABLE public.stripe_events ALTER COLUMN status SET DEFAULT 'processing';

DO $$ BEGIN
  ALTER TABLE public.stripe_events
    ADD CONSTRAINT stripe_events_status_check CHECK (status IN ('processing', 'completed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.iap_events ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.iap_events ADD COLUMN IF NOT EXISTS lease_until  TIMESTAMPTZ;
ALTER TABLE public.iap_events ADD COLUMN IF NOT EXISTS attempts     INT  NOT NULL DEFAULT 0;
ALTER TABLE public.iap_events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.iap_events ALTER COLUMN status SET DEFAULT 'processing';

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
ALTER TABLE public.token_ledger DROP CONSTRAINT IF EXISTS token_ledger_type_check;
ALTER TABLE public.token_ledger ADD CONSTRAINT token_ledger_type_check CHECK (type IN (
  'purchase','gift_sent','gift_received','challenge_vote',
  'creator_goal_contribution','platform_fee','refund',
  'adjustment','circle_pool_distribution','streak_bonus',
  'live_gift','iap_purchase'
));

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
));

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
  currency               TEXT NOT NULL DEFAULT 'usd',
  paid_at                TIMESTAMPTZ NOT NULL,
  month                  TEXT NOT NULL,                              -- 'YYYY-MM' (UTC) of paid_at
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
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

  SELECT COALESCE(SUM(GREATEST(amount_cents - refunded_cents, 0)), 0) INTO v_gross
    FROM public.pro_revenue_ledger WHERE month = p_month;
  IF v_gross <> p_expected_gross THEN
    RAISE EXCEPTION 'GROSS_CHANGED: ledger % vs expected %', v_gross, p_expected_gross;
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
  IF v_stream.status = 'ended' THEN RAISE EXCEPTION 'STREAM_ENDED'; END IF;
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
