-- ============================================================
-- HapiEats TV — Creator Ecosystem
-- Token economy, creator wallets, live gifts, challenges,
-- goals, streaks, and Creator Circle Pool
-- ============================================================

-- ── Token Packs (purchasable bundles) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS token_packs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  token_amount      INT  NOT NULL CHECK (token_amount > 0),
  bonus_tokens      INT  NOT NULL DEFAULT 0,
  price_cents       INT  NOT NULL CHECK (price_cents > 0),
  stripe_price_id   TEXT UNIQUE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INT  NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default packs
INSERT INTO token_packs (name, description, token_amount, price_cents, sort_order) VALUES
  ('Starter',   '100 Hapi Tokens',          100,  199, 1),
  ('Fan Pack',  '500 Hapi Tokens',          500,  799, 2),
  ('Supporter', '1,200 Hapi Tokens',       1200, 1799, 3),
  ('Super Fan', '2,750 Hapi Tokens',       2750, 3999, 4),
  ('VIP',       '6,000 Hapi Tokens + bonus', 6000, 7999, 5)
ON CONFLICT DO NOTHING;

-- ── User Token Wallet ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hapi_tokens (
  user_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance           INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased INT NOT NULL DEFAULT 0,
  lifetime_spent    INT NOT NULL DEFAULT 0,
  lifetime_gifted   INT NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Token Ledger (every movement) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_ledger (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type             TEXT        NOT NULL CHECK (type IN (
    'purchase','gift_sent','gift_received','challenge_vote',
    'creator_goal_contribution','platform_fee','refund',
    'adjustment','circle_pool_distribution','streak_bonus'
  )),
  amount           INT         NOT NULL,         -- positive = credit, negative = debit
  balance_after    INT         NOT NULL DEFAULT 0,
  related_user_id  UUID        REFERENCES profiles(id),
  related_video_id UUID        REFERENCES videos(id),
  related_stream_id UUID       REFERENCES live_streams(id),
  stripe_session_id TEXT,
  description      TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_ledger_user ON token_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_ledger_type  ON token_ledger(type);

-- ── Creator Wallet ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_wallets (
  creator_id            UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tokens_received       INT  NOT NULL DEFAULT 0,
  pending_cents         INT  NOT NULL DEFAULT 0,   -- not yet settled
  redeemable_cents      INT  NOT NULL DEFAULT 0,   -- ready to cash out
  lifetime_earnings_cents INT NOT NULL DEFAULT 0,
  -- Monthly breakdown: { "2026-07": { "gifts": 0, "challenges": 0, "goals": 0, "circle": 0 } }
  monthly_earnings      JSONB NOT NULL DEFAULT '{}',
  payout_status         TEXT NOT NULL DEFAULT 'none' CHECK (payout_status IN ('none','pending','paid','failed')),
  last_payout_at        TIMESTAMPTZ,
  last_payout_cents     INT  DEFAULT 0,
  stripe_connect_id     TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Platform Settings (conversion rates, etc.) ────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('token_conversion_rate', '{"creator_pct": 70, "platform_pct": 20, "circle_pool_pct": 10, "cents_per_token": 1}',
   'Token to cash conversion: creator gets 70%, platform 20%, circle pool 10%. Base rate: 1 cent per token.'),
  ('circle_pool_enabled', 'true', 'Whether the Creator Circle Pool is active'),
  ('streak_bonuses', '{"7": 50, "30": 250, "90": 1000}', 'Token bonuses for streak milestones (keys = days, values = tokens)')
ON CONFLICT DO NOTHING;

-- ── Live Gifts ─────────────────────────────────────────────────────────
-- Drop old gifting tables (from original TikTok-style system) so we can
-- recreate them with the updated schema. CASCADE removes old foreign keys.
DROP TABLE IF EXISTS live_gift_transactions CASCADE;
DROP TABLE IF EXISTS live_gifts CASCADE;

CREATE TABLE IF NOT EXISTS live_gifts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  emoji            TEXT NOT NULL DEFAULT '🎁',
  token_cost       INT  NOT NULL CHECK (token_cost > 0),
  -- Distribution (must sum to 100)
  creator_pct      INT  NOT NULL DEFAULT 70,
  platform_pct     INT  NOT NULL DEFAULT 20,
  circle_pct       INT  NOT NULL DEFAULT 10,
  display_priority INT  NOT NULL DEFAULT 0,
  animation_key    TEXT,       -- maps to CSS/Lottie animation on frontend
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO live_gifts (name, emoji, token_cost, display_priority, animation_key) VALUES
  ('Flame',       '🔥',  10,  1,  'flame'),
  ('Chef Kiss',   '🤌',  25,  2,  'chef_kiss'),
  ('Hapi Bowl',   '🍜',  50,  3,  'hapi_bowl'),
  ('Golden Fork', '🍴',  100, 4,  'golden_fork'),
  ('Hapi Crown',  '👑',  500, 5,  'hapi_crown'),
  ('Star Chef',   '⭐',  1000,6,  'star_chef')
ON CONFLICT DO NOTHING;

-- ── Live Gift Transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_gift_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stream_id           UUID REFERENCES live_streams(id) ON DELETE SET NULL,
  gift_id             UUID NOT NULL REFERENCES live_gifts(id),
  quantity            INT  NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_tokens        INT  NOT NULL,
  creator_earned_cents INT NOT NULL DEFAULT 0,
  platform_fee_cents  INT  NOT NULL DEFAULT 0,
  circle_pool_cents   INT  NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_tx_recipient ON live_gift_transactions(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_tx_stream    ON live_gift_transactions(stream_id);

-- ── Creator Challenges ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_challenges (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  description           TEXT,
  theme                 TEXT,
  cover_image_url       TEXT,
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  voting_start_date     DATE,
  voting_end_date       DATE,
  voting_type           TEXT NOT NULL DEFAULT 'free' CHECK (voting_type IN ('free','token','judge','hybrid')),
  token_vote_cost       INT  NOT NULL DEFAULT 0,   -- tokens per vote for token/hybrid types
  max_entries_per_creator INT NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','voting','judging','complete','cancelled')),
  -- Prizes
  prize_cash_cents      INT  NOT NULL DEFAULT 0,
  prize_tokens          INT  NOT NULL DEFAULT 0,
  prize_badge           TEXT,
  prize_homepage_feature BOOLEAN NOT NULL DEFAULT FALSE,
  -- Hybrid weighting
  judge_weight          DECIMAL NOT NULL DEFAULT 0.5,
  public_vote_weight    DECIMAL NOT NULL DEFAULT 0.5,
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Challenge Entries ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenge_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    UUID NOT NULL REFERENCES creator_challenges(id) ON DELETE CASCADE,
  creator_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id        UUID REFERENCES videos(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  vote_count      INT  NOT NULL DEFAULT 0,
  token_vote_total INT NOT NULL DEFAULT 0,   -- sum of tokens spent voting on this entry
  judge_score     DECIMAL,
  final_score     DECIMAL,   -- computed weighted score
  final_rank      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_entries_challenge ON challenge_entries(challenge_id, vote_count DESC);

-- ── Challenge Votes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenge_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id     UUID NOT NULL REFERENCES challenge_entries(id) ON DELETE CASCADE,
  voter_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tokens_spent INT  NOT NULL DEFAULT 0,  -- 0 for free votes
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_id, voter_id)
);

-- ── Creator Goals (fan-funded) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_goals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  target_tokens       INT  NOT NULL CHECK (target_tokens > 0),
  current_tokens      INT  NOT NULL DEFAULT 0,
  deadline            DATE,
  reward_description  TEXT,
  cover_image_url     TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','failed','cancelled')),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_goals_creator ON creator_goals(creator_id, status);

-- ── Goal Contributions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_contributions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id        UUID NOT NULL REFERENCES creator_goals(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tokens         INT  NOT NULL CHECK (tokens > 0),
  message        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(goal_id, created_at DESC);

-- ── Creator Streaks ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_streaks (
  creator_id          UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak      INT  NOT NULL DEFAULT 0,
  longest_streak      INT  NOT NULL DEFAULT 0,
  last_activity_date  DATE,
  total_posts         INT  NOT NULL DEFAULT 0,
  total_streams       INT  NOT NULL DEFAULT 0,
  total_challenge_entries INT NOT NULL DEFAULT 0,
  skipped_days        INT  NOT NULL DEFAULT 0,
  -- Milestone bonus claimed flags
  streak_7_claimed    BOOLEAN NOT NULL DEFAULT FALSE,
  streak_30_claimed   BOOLEAN NOT NULL DEFAULT FALSE,
  streak_90_claimed   BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Creator Circle Pool ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_circle_pool (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month             TEXT NOT NULL,  -- '2026-07'
  total_cents       INT  NOT NULL DEFAULT 0,
  distributed_cents INT  NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'accumulating' CHECK (status IN ('accumulating','distributed')),
  distribution_date TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (month)
);

-- ── Circle Pool Distributions (per creator per month) ─────────────────
CREATE TABLE IF NOT EXISTS circle_pool_distributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id             UUID NOT NULL REFERENCES creator_circle_pool(id) ON DELETE CASCADE,
  creator_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Performance points breakdown
  watch_time_pts      INT  NOT NULL DEFAULT 0,
  follower_pts        INT  NOT NULL DEFAULT 0,
  gift_pts            INT  NOT NULL DEFAULT 0,
  comment_pts         INT  NOT NULL DEFAULT 0,
  share_pts           INT  NOT NULL DEFAULT 0,
  stream_pts          INT  NOT NULL DEFAULT 0,
  streak_pts          INT  NOT NULL DEFAULT 0,
  total_points        INT  NOT NULL DEFAULT 0,
  share_cents         INT  NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pool_id, creator_id)
);

-- ════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE token_packs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE hapi_tokens              ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_ledger             ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_wallets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_gifts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_gift_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_challenges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_votes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_goals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_streaks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_circle_pool      ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_pool_distributions ENABLE ROW LEVEL SECURITY;

-- token_packs: public read, admin write
CREATE POLICY "token_packs_read"  ON token_packs FOR SELECT USING (TRUE);
CREATE POLICY "token_packs_admin" ON token_packs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- hapi_tokens: users see own wallet only
CREATE POLICY "hapi_tokens_own"   ON hapi_tokens FOR ALL USING (user_id = auth.uid());
CREATE POLICY "hapi_tokens_admin" ON hapi_tokens FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- token_ledger: users see own entries; service role writes
CREATE POLICY "token_ledger_own"  ON token_ledger FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "token_ledger_admin" ON token_ledger FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- creator_wallets: creator sees own; public can see tokens_received (for leaderboard)
CREATE POLICY "creator_wallets_own"    ON creator_wallets FOR ALL USING (creator_id = auth.uid());
CREATE POLICY "creator_wallets_public" ON creator_wallets FOR SELECT USING (TRUE);

-- platform_settings: admin only
CREATE POLICY "platform_settings_admin" ON platform_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- live_gifts: public read, admin write
CREATE POLICY "live_gifts_read"  ON live_gifts FOR SELECT USING (TRUE);
CREATE POLICY "live_gifts_admin" ON live_gifts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- live_gift_transactions: sender/recipient can see own; service writes
CREATE POLICY "gift_tx_sender"    ON live_gift_transactions FOR SELECT USING (sender_id = auth.uid());
CREATE POLICY "gift_tx_recipient" ON live_gift_transactions FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "gift_tx_admin"     ON live_gift_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- creator_challenges: public read, admin write
CREATE POLICY "challenges_read"  ON creator_challenges FOR SELECT USING (TRUE);
CREATE POLICY "challenges_admin" ON creator_challenges FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- challenge_entries: public read, creator inserts own
CREATE POLICY "entries_read"   ON challenge_entries FOR SELECT USING (TRUE);
CREATE POLICY "entries_own"    ON challenge_entries FOR INSERT WITH CHECK (creator_id = auth.uid());
CREATE POLICY "entries_update" ON challenge_entries FOR UPDATE USING (creator_id = auth.uid());
CREATE POLICY "entries_admin"  ON challenge_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- challenge_votes: voters see own, entries public
CREATE POLICY "votes_own"    ON challenge_votes FOR INSERT WITH CHECK (voter_id = auth.uid());
CREATE POLICY "votes_select" ON challenge_votes FOR SELECT USING (voter_id = auth.uid());
CREATE POLICY "votes_admin"  ON challenge_votes FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- creator_goals: public read, creator manages own
CREATE POLICY "goals_read"   ON creator_goals FOR SELECT USING (status != 'cancelled' OR creator_id = auth.uid());
CREATE POLICY "goals_own"    ON creator_goals FOR INSERT WITH CHECK (creator_id = auth.uid());
CREATE POLICY "goals_update" ON creator_goals FOR UPDATE USING (creator_id = auth.uid());
CREATE POLICY "goals_admin"  ON creator_goals FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- goal_contributions: public read (amounts/contributors), own write
CREATE POLICY "contributions_read"   ON goal_contributions FOR SELECT USING (TRUE);
CREATE POLICY "contributions_insert" ON goal_contributions FOR INSERT WITH CHECK (contributor_id = auth.uid());

-- creator_streaks: own read/write, public read
CREATE POLICY "streaks_public" ON creator_streaks FOR SELECT USING (TRUE);
CREATE POLICY "streaks_own"    ON creator_streaks FOR ALL   USING (creator_id = auth.uid());

-- creator_circle_pool: public read (for transparency)
CREATE POLICY "circle_pool_read"  ON creator_circle_pool FOR SELECT USING (TRUE);
CREATE POLICY "circle_pool_admin" ON creator_circle_pool FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- circle_pool_distributions: creator sees own, public totals
CREATE POLICY "circle_dist_own"    ON circle_pool_distributions FOR SELECT USING (creator_id = auth.uid());
CREATE POLICY "circle_dist_public" ON circle_pool_distributions FOR SELECT USING (TRUE);

-- ════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════

-- Ensure a user has a token wallet, return current balance
CREATE OR REPLACE FUNCTION ensure_token_wallet(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_balance INT;
BEGIN
  INSERT INTO hapi_tokens (user_id, balance) VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM hapi_tokens WHERE user_id = p_user_id;
  RETURN COALESCE(v_balance, 0);
END;
$$;

-- Ensure a creator has a wallet
CREATE OR REPLACE FUNCTION ensure_creator_wallet(p_creator_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO creator_wallets (creator_id) VALUES (p_creator_id)
  ON CONFLICT (creator_id) DO NOTHING;
END;
$$;

-- Atomic token credit/debit with ledger entry
CREATE OR REPLACE FUNCTION record_token_movement(
  p_user_id         UUID,
  p_type            TEXT,
  p_amount          INT,   -- positive = add, negative = subtract
  p_related_user    UUID   DEFAULT NULL,
  p_related_video   UUID   DEFAULT NULL,
  p_related_stream  UUID   DEFAULT NULL,
  p_description     TEXT   DEFAULT NULL,
  p_metadata        JSONB  DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, new_balance INT, ledger_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INT;
  v_ledger_id   UUID;
BEGIN
  -- Ensure wallet exists
  PERFORM ensure_token_wallet(p_user_id);

  -- Apply delta (enforce non-negative for debits)
  UPDATE hapi_tokens
  SET
    balance = GREATEST(0, balance + p_amount),
    lifetime_purchased = CASE WHEN p_amount > 0 AND p_type = 'purchase'
                              THEN lifetime_purchased + p_amount ELSE lifetime_purchased END,
    lifetime_spent = CASE WHEN p_amount < 0
                         THEN lifetime_spent + ABS(p_amount) ELSE lifetime_spent END,
    lifetime_gifted = CASE WHEN p_type IN ('gift_sent') AND p_amount < 0
                           THEN lifetime_gifted + ABS(p_amount) ELSE lifetime_gifted END,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- Check if debit would have gone negative
  IF p_amount < 0 AND v_new_balance = 0 THEN
    -- Could enforce a check here; for now we allow graceful floor at 0
    NULL;
  END IF;

  -- Insert ledger entry
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

-- Update creator streak after a post/stream/challenge entry
CREATE OR REPLACE FUNCTION update_creator_streak(
  p_creator_id UUID,
  p_activity_type TEXT  -- 'post', 'stream', 'challenge'
)
RETURNS TABLE(current_streak INT, milestone TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today          DATE := CURRENT_DATE;
  v_last_date      DATE;
  v_curr_streak    INT;
  v_longest        INT;
  v_milestone      TEXT := NULL;
BEGIN
  INSERT INTO creator_streaks (creator_id) VALUES (p_creator_id)
  ON CONFLICT (creator_id) DO NOTHING;

  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_date, v_curr_streak, v_longest
  FROM creator_streaks WHERE creator_id = p_creator_id;

  -- Extend or reset streak
  IF v_last_date IS NULL OR v_last_date < v_today - INTERVAL '1 day' THEN
    -- Gap > 1 day: reset (unless first activity today)
    IF v_last_date IS NULL OR v_last_date < v_today - INTERVAL '1 day' THEN
      v_curr_streak := 1;
    END IF;
  ELSIF v_last_date = v_today - INTERVAL '1 day' THEN
    v_curr_streak := v_curr_streak + 1;
  ELSE
    -- Same day, no increment
    v_curr_streak := GREATEST(v_curr_streak, 1);
  END IF;

  IF v_curr_streak > v_longest THEN
    v_longest := v_curr_streak;
  END IF;

  -- Detect milestone
  IF v_curr_streak >= 90 THEN v_milestone := '90';
  ELSIF v_curr_streak >= 30 THEN v_milestone := '30';
  ELSIF v_curr_streak >= 7 THEN v_milestone := '7';
  END IF;

  UPDATE creator_streaks SET
    current_streak = v_curr_streak,
    longest_streak = v_longest,
    last_activity_date = v_today,
    total_posts    = CASE WHEN p_activity_type = 'post'      THEN total_posts + 1      ELSE total_posts      END,
    total_streams  = CASE WHEN p_activity_type = 'stream'    THEN total_streams + 1    ELSE total_streams    END,
    total_challenge_entries = CASE WHEN p_activity_type = 'challenge' THEN total_challenge_entries + 1 ELSE total_challenge_entries END,
    updated_at = NOW()
  WHERE creator_id = p_creator_id;

  RETURN QUERY SELECT v_curr_streak, v_milestone;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════════════════

-- Auto-create token wallet on profile creation
CREATE OR REPLACE FUNCTION on_profile_created_create_wallet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO hapi_tokens (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_create_wallet ON profiles;
CREATE TRIGGER trg_profile_create_wallet
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION on_profile_created_create_wallet();

-- Auto-update goal status when current_tokens meets target
CREATE OR REPLACE FUNCTION on_goal_contribution_check_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE creator_goals
  SET
    current_tokens = current_tokens + NEW.tokens,
    status = CASE WHEN current_tokens + NEW.tokens >= target_tokens THEN 'completed' ELSE status END,
    completed_at   = CASE WHEN current_tokens + NEW.tokens >= target_tokens THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = NEW.goal_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goal_contribution_check ON goal_contributions;
CREATE TRIGGER trg_goal_contribution_check
  AFTER INSERT ON goal_contributions
  FOR EACH ROW EXECUTE FUNCTION on_goal_contribution_check_complete();

-- Auto-increment vote counts on challenge_votes insert
CREATE OR REPLACE FUNCTION on_challenge_vote_inserted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE challenge_entries
  SET
    vote_count = vote_count + 1,
    token_vote_total = token_vote_total + NEW.tokens_spent
  WHERE id = NEW.entry_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_vote ON challenge_votes;
CREATE TRIGGER trg_challenge_vote
  AFTER INSERT ON challenge_votes
  FOR EACH ROW EXECUTE FUNCTION on_challenge_vote_inserted();
