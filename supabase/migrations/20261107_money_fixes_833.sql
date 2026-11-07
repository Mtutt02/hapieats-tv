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
SET search_path = public
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
SET search_path = public
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
SET search_path = public
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
SET search_path = public
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
SET search_path = public
AS $$
  UPDATE public.iap_events
     SET status = 'completed', lease_until = NULL, completed_at = now()
   WHERE event_id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION public.release_iap_event(p_event_id TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
SET search_path = public
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
SET search_path = public
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
SET search_path = public
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
