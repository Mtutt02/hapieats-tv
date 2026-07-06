-- ============================================================
-- Creator Ecosystem — Functions & Triggers (run separately)
-- Run AFTER 20260703_creator_ecosystem.sql
-- ============================================================

-- ── Helper: ensure token wallet ──────────────────────────────
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

-- ── Helper: ensure creator wallet ────────────────────────────
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

-- ── Atomic token credit/debit with ledger entry ───────────────
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
  v_new_balance INT;
  v_ledger_id   UUID;
BEGIN
  PERFORM ensure_token_wallet(p_user_id);

  UPDATE hapi_tokens
  SET
    balance            = GREATEST(0, balance + p_amount),
    lifetime_purchased = CASE WHEN p_amount > 0 AND p_type = 'purchase'
                              THEN lifetime_purchased + p_amount ELSE lifetime_purchased END,
    lifetime_spent     = CASE WHEN p_amount < 0
                              THEN lifetime_spent + ABS(p_amount) ELSE lifetime_spent END,
    lifetime_gifted    = CASE WHEN p_type = 'gift_sent' AND p_amount < 0
                              THEN lifetime_gifted + ABS(p_amount) ELSE lifetime_gifted END,
    updated_at         = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

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

-- ── Creator streak tracker ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_creator_streak(
  p_creator_id    UUID,
  p_activity_type TEXT
)
RETURNS TABLE(current_streak INT, milestone TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

-- ── Trigger: auto-create token wallet on new profile ──────────
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

-- ── Trigger: mark goal complete when target reached ───────────
CREATE OR REPLACE FUNCTION on_goal_contribution_check_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE creator_goals
  SET
    current_tokens = current_tokens + NEW.tokens,
    status         = CASE WHEN current_tokens + NEW.tokens >= target_tokens
                          THEN 'completed' ELSE status END,
    completed_at   = CASE WHEN current_tokens + NEW.tokens >= target_tokens
                          THEN NOW() ELSE completed_at END,
    updated_at     = NOW()
  WHERE id = NEW.goal_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goal_contribution_check ON goal_contributions;
CREATE TRIGGER trg_goal_contribution_check
  AFTER INSERT ON goal_contributions
  FOR EACH ROW EXECUTE FUNCTION on_goal_contribution_check_complete();

-- ── Trigger: increment vote counts on challenge vote ──────────
CREATE OR REPLACE FUNCTION on_challenge_vote_inserted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE challenge_entries
  SET
    vote_count       = vote_count + 1,
    token_vote_total = token_vote_total + NEW.tokens_spent
  WHERE id = NEW.entry_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_vote ON challenge_votes;
CREATE TRIGGER trg_challenge_vote
  AFTER INSERT ON challenge_votes
  FOR EACH ROW EXECUTE FUNCTION on_challenge_vote_inserted();
