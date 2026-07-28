-- ============================================================
-- Security Patches — 2026-07-03
-- 1. Drop overly-permissive creator_wallets public RLS policy
--    (was exposing stripe_connect_id + all financial columns)
-- 2. Fix record_token_movement race condition
--    (SELECT FOR UPDATE + explicit balance check → raise exception)
-- ============================================================

-- ── 1. Tighten creator_wallets RLS ───────────────────────────
-- The "creator_wallets_public" policy used USING (TRUE), which
-- exposed every column — including stripe_connect_id,
-- pending_cents, redeemable_cents, lifetime_earnings_cents,
-- monthly_earnings — to any request using the anon key.
--
-- All wallet reads in app code use the service-role client
-- (bypasses RLS), so this policy is not needed for any feature.
-- Creators read their own wallet via creator_wallets_own (FOR ALL).
-- Admins read all wallets via the service role.
-- Public leaderboard data (tokens_received) is available via
-- the creator_public_stats view below.

DROP POLICY IF EXISTS "creator_wallets_public" ON creator_wallets;

-- Safe public read: only tokens_received (no financial data)
CREATE OR REPLACE VIEW creator_public_stats AS
  SELECT creator_id, tokens_received
  FROM creator_wallets;

-- ── 2. Fix record_token_movement — atomic balance enforcement ─
-- Old version: GREATEST(0, balance + p_amount) silently floored
-- at 0, allowing concurrent requests to overdraw tokens.
-- New version: SELECT FOR UPDATE locks the row, checks balance,
-- raises INSUFFICIENT_BALANCE if the debit can't be satisfied.

CREATE OR REPLACE FUNCTION record_token_movement(
  p_user_id         UUID,
  p_type            TEXT,
  p_amount          INT,
  p_related_user    UUID  DEFAULT NULL,
  p_related_video   UUID  DEFAULT NULL,
  p_related_stream  UUID  DEFAULT NULL,
  p_description     TEXT  DEFAULT NULL,
  p_metadata        JSONB DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, new_balance INT, ledger_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance     INT;
  v_ledger_id       UUID;
BEGIN
  -- Ensure wallet row exists before locking
  INSERT INTO hapi_tokens (user_id, balance) VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock the row so concurrent transactions queue here, not race
  SELECT balance INTO v_current_balance
    FROM hapi_tokens
   WHERE user_id = p_user_id
     FOR UPDATE;

  -- Hard-fail debits that would go negative
  IF p_amount < 0 AND (v_current_balance + p_amount) < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: required %, available %',
      ABS(p_amount), v_current_balance
      USING ERRCODE = 'P0002';
  END IF;

  v_new_balance := v_current_balance + p_amount;

  UPDATE hapi_tokens
  SET
    balance            = v_new_balance,
    lifetime_purchased = CASE WHEN p_amount > 0 AND p_type = 'purchase'
                              THEN lifetime_purchased + p_amount
                              ELSE lifetime_purchased END,
    lifetime_spent     = CASE WHEN p_amount < 0
                              THEN lifetime_spent + ABS(p_amount)
                              ELSE lifetime_spent END,
    lifetime_gifted    = CASE WHEN p_type = 'gift_sent' AND p_amount < 0
                              THEN lifetime_gifted + ABS(p_amount)
                              ELSE lifetime_gifted END,
    updated_at         = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO token_ledger (
    user_id, type, amount, balance_after,
    related_user_id, related_video_id, related_stream_id,
    description, metadata
  ) VALUES (
    p_user_id, p_type, p_amount, v_new_balance,
    p_related_user, p_related_video, p_related_stream,
    p_description, p_metadata
  )
  RETURNING id INTO v_ledger_id;

  RETURN QUERY SELECT TRUE, v_new_balance, v_ledger_id;
END;
$$;
