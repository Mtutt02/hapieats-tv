-- ============================================================
-- Creator Monetization Unlock System
-- Creators start LOCKED. They unlock via:
--   1. Auto-unlock: purchase 500+ Hapi Tokens (lifetime)
--   2. Manual unlock: submit request → admin approves
-- Earnings accumulate while locked; payout is blocked until unlocked.
-- ============================================================

-- ── 1. Extend creator_wallets ────────────────────────────────
ALTER TABLE creator_wallets
  ADD COLUMN IF NOT EXISTS monetization_status TEXT NOT NULL DEFAULT 'locked'
    CHECK (monetization_status IN ('locked', 'pending_review', 'unlocked')),
  ADD COLUMN IF NOT EXISTS monetization_unlocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monetization_unlock_reason TEXT,     -- 'token_purchase_threshold' | 'admin_approved'
  ADD COLUMN IF NOT EXISTS monetization_request_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monetization_request_note TEXT;

-- ── 2. Monetization unlock requests table ───────────────────
CREATE TABLE IF NOT EXISTS monetization_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'denied')),
  request_note    TEXT,                          -- creator's message to admin
  admin_note      TEXT,                          -- admin's response
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, status)                    -- one pending per creator
);

ALTER TABLE monetization_requests ENABLE ROW LEVEL SECURITY;

-- Creators can read their own requests
CREATE POLICY "creators_read_own_monetization_requests"
  ON monetization_requests FOR SELECT
  USING (auth.uid() = creator_id);

-- Creators can insert (one pending at a time enforced by UNIQUE)
CREATE POLICY "creators_insert_monetization_requests"
  ON monetization_requests FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Admins/superadmins can do everything
CREATE POLICY "admins_manage_monetization_requests"
  ON monetization_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
  );

-- ── 3. Auto-unlock function ──────────────────────────────────
-- Called after every token purchase. If creator has 500+ tokens lifetime,
-- auto-unlock their monetization.
CREATE OR REPLACE FUNCTION check_monetization_auto_unlock(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lifetime   INT;
  v_is_creator BOOLEAN;
  v_status     TEXT;
BEGIN
  -- Only creators have wallets
  SELECT is_creator INTO v_is_creator
    FROM profiles WHERE id = p_user_id;
  IF NOT FOUND OR NOT v_is_creator THEN RETURN FALSE; END IF;

  -- Check current monetization status
  SELECT monetization_status INTO v_status
    FROM creator_wallets WHERE creator_id = p_user_id;
  IF NOT FOUND OR v_status = 'unlocked' THEN RETURN FALSE; END IF;

  -- Check lifetime token purchases
  SELECT lifetime_purchased INTO v_lifetime
    FROM hapi_tokens WHERE user_id = p_user_id;
  IF NOT FOUND OR v_lifetime < 500 THEN RETURN FALSE; END IF;

  -- Auto-unlock!
  UPDATE creator_wallets
    SET monetization_status      = 'unlocked',
        monetization_unlocked_at = NOW(),
        monetization_unlock_reason = 'token_purchase_threshold'
    WHERE creator_id = p_user_id
      AND monetization_status <> 'unlocked';

  RETURN TRUE;
END;
$$;

-- ── 4. Admin approve/deny function ──────────────────────────
CREATE OR REPLACE FUNCTION admin_review_monetization_request(
  p_request_id  UUID,
  p_decision    TEXT,   -- 'approved' | 'denied'
  p_admin_id    UUID,
  p_admin_note  TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_role       TEXT;
BEGIN
  -- Verify caller is admin/superadmin
  SELECT role INTO v_role FROM profiles WHERE id = p_admin_id;
  IF v_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Get creator
  SELECT creator_id INTO v_creator_id
    FROM monetization_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Update request
  UPDATE monetization_requests
    SET status      = p_decision,
        admin_note  = p_admin_note,
        reviewed_by = p_admin_id,
        reviewed_at = NOW()
    WHERE id = p_request_id;

  -- If approved, unlock the wallet
  IF p_decision = 'approved' THEN
    UPDATE creator_wallets
      SET monetization_status       = 'unlocked',
          monetization_unlocked_at  = NOW(),
          monetization_unlock_reason = 'admin_approved'
      WHERE creator_id = v_creator_id
        AND monetization_status <> 'unlocked';
  END IF;

  RETURN TRUE;
END;
$$;

-- ── 5. Index ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_monetization_requests_status
  ON monetization_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_wallets_monetization_status
  ON creator_wallets (monetization_status);
