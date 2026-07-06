-- ============================================================
-- HapiEats TV — Feature Expansion Migration
-- June 2026
-- ============================================================

-- 1. Add missing columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_id TEXT,
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (profile_visibility IN ('public', 'followers', 'private')),
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_in_search BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Add missing columns to videos
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'channel'
    CHECK (post_type IN ('general', 'channel')),
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- 3. Add missing columns to channels
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

-- 4. Token balances
CREATE TABLE IF NOT EXISTS token_balances (
  user_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance      INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Token purchases
CREATE TABLE IF NOT EXISTS token_purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_tokens       INTEGER NOT NULL,
  amount_usd          NUMERIC(10,2) NOT NULL,
  stripe_session_id   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Live gifts
CREATE TABLE IF NOT EXISTS live_gifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id    UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  sender_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gift_type    TEXT NOT NULL,
  gift_emoji   TEXT NOT NULL,
  gift_name    TEXT NOT NULL,
  token_cost   INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Content reports
CREATE TABLE IF NOT EXISTS content_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id     UUID REFERENCES videos(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  detail       TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID REFERENCES profiles(id)
);

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_token_purchases_user ON token_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_live_gifts_stream ON live_gifts(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_gifts_sender ON live_gifts(sender_id);
CREATE INDEX IF NOT EXISTS idx_live_gifts_creator ON live_gifts(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_video ON content_reports(video_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_videos_post_type ON videos(post_type);
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;

-- 9. RLS Policies

-- token_balances: users see/update only their own
ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_balance" ON token_balances
  FOR ALL USING (auth.uid() = user_id);

-- token_purchases: users see only their own
ALTER TABLE token_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_purchases" ON token_purchases
  FOR SELECT USING (auth.uid() = user_id);

-- live_gifts: sender and creator can read; service role inserts
ALTER TABLE live_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gift_parties_read" ON live_gifts
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = creator_id);

-- content_reports: reporter can read their own; admins read all
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporter_read_own" ON content_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- 10. Stripe webhook handler: credit tokens on completed checkout
-- (Handled in application code via /api/stripe/webhook)

-- 11. Function: upsert token balance safely
CREATE OR REPLACE FUNCTION upsert_token_balance(p_user_id UUID, p_delta INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO token_balances (user_id, balance)
  VALUES (p_user_id, GREATEST(0, p_delta))
  ON CONFLICT (user_id) DO UPDATE
  SET balance = GREATEST(0, token_balances.balance + p_delta),
      updated_at = NOW();
END;
$$;
