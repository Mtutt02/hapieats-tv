-- Mobile app support: push tokens + IAP idempotency log
-- Additive only (CREATE IF NOT EXISTS) — safe to run on live DB.

-- ── Expo push tokens ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own push tokens"
    ON push_tokens FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id);

-- ── RevenueCat webhook idempotency log ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS iap_events (
  event_id    text PRIMARY KEY,
  user_id     uuid,
  type        text,
  product_id  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE iap_events ENABLE ROW LEVEL SECURITY;
-- No user policies: service-role only (webhook writes, admin reads).
