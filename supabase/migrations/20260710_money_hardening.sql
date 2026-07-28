-- ============================================================
-- HapiEats TV — Money Layer Hardening (2026-07-10)
-- 1. stripe_events: webhook idempotency ledger (service-role only)
-- 2. wallet_add(): atomic creator wallet credit (replaces
--    read-then-upsert race in gift routes)
-- 3. videos_status_check widened to allow 'failed' (ghost uploads)
-- 4. flavor_cashout_one_pending: at most one pending cashout
--    request per creator
-- All statements are additive — no data is dropped or mutated.
-- ============================================================

-- ── 1. Stripe webhook idempotency table ────────────────────────────────
-- Each processed Stripe event id is recorded here. A unique-violation on
-- insert (23505) means the event was already handled — the webhook
-- returns 200 without re-processing.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id         TEXT PRIMARY KEY,
  type       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS on, no policies: only the service role (which bypasses RLS) can
-- read or write. Anon/authenticated clients get nothing.
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- ── 2. Atomic creator wallet credit ────────────────────────────────────
-- Column names match creator_wallets in 20260703_creator_ecosystem.sql:
--   tokens_received, redeemable_cents, lifetime_earnings_cents,
--   monthly_earnings (JSONB: { "YYYY-MM": { gifts, challenges, goals, circle } })
-- Credits are recorded under the current month's "gifts" bucket, matching
-- the behavior of the gift API routes this function replaces.
CREATE OR REPLACE FUNCTION public.wallet_add(
  p_creator_id UUID,
  p_tokens     INT,
  p_cents      INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month TEXT := to_char(now(), 'YYYY-MM');
BEGIN
  INSERT INTO public.creator_wallets (
    creator_id, tokens_received, redeemable_cents,
    lifetime_earnings_cents, monthly_earnings, updated_at
  )
  VALUES (
    p_creator_id,
    p_tokens,
    p_cents,
    p_cents,
    jsonb_build_object(
      v_month,
      jsonb_build_object('gifts', p_cents, 'challenges', 0, 'goals', 0, 'circle', 0)
    ),
    now()
  )
  ON CONFLICT (creator_id) DO UPDATE SET
    tokens_received         = creator_wallets.tokens_received         + p_tokens,
    redeemable_cents        = creator_wallets.redeemable_cents        + p_cents,
    lifetime_earnings_cents = creator_wallets.lifetime_earnings_cents + p_cents,
    monthly_earnings = jsonb_set(
      COALESCE(creator_wallets.monthly_earnings, '{}'::jsonb),
      ARRAY[v_month],
      jsonb_set(
        COALESCE(
          creator_wallets.monthly_earnings -> v_month,
          '{"gifts":0,"challenges":0,"goals":0,"circle":0}'::jsonb
        ),
        '{gifts}',
        to_jsonb(
          COALESCE((creator_wallets.monthly_earnings -> v_month ->> 'gifts')::INT, 0) + p_cents
        )
      )
    ),
    updated_at = now();
END;
$$;

-- Service-role only: this function credits money and must never be
-- callable by end users.
REVOKE ALL ON FUNCTION public.wallet_add(UUID, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_add(UUID, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.wallet_add(UUID, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_add(UUID, INT, INT) TO service_role;

-- ── 3. Allow 'failed' video status (ghost uploads) ─────────────────────
-- 001_initial.sql constrains videos.status to
-- ('uploading','processing','ready','errored'). The Mux webhook now marks
-- errored/cancelled uploads as 'failed'. Widening the CHECK is data-safe:
-- no existing rows are touched and all previous values remain valid.
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_status_check
  CHECK (status IN ('uploading','processing','ready','errored','failed'));

-- ── 4. One pending cashout request per creator ─────────────────────────
-- Actual table name is flavor_cashout_requests (20260624_flavor_points.sql);
-- status values: pending / approved / paid / rejected.
CREATE UNIQUE INDEX IF NOT EXISTS flavor_cashout_one_pending
  ON public.flavor_cashout_requests (creator_id)
  WHERE status = 'pending';
