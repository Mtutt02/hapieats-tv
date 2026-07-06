-- ──────────────────────────────────────────────────────────────────────────────
-- 20260703_live_chat.sql
-- Live chat system for live room.
-- Run in Supabase SQL Editor (new tab) after creator_ecosystem migrations.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id    UUID        NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  sender_id    UUID        NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  message      TEXT        NOT NULL
                           CHECK (char_length(message) BETWEEN 1 AND 300),
  -- 'message' = normal chat, 'gift_event' = auto-posted by gift API, 'system' = server-generated
  type         TEXT        NOT NULL DEFAULT 'message'
                           CHECK (type IN ('message', 'gift_event', 'system')),
  -- Fields populated for gift_event rows
  gift_name    TEXT,
  gift_emoji   TEXT,
  gift_tokens  INT,
  -- Private message support
  is_private   BOOLEAN     NOT NULL DEFAULT FALSE,
  recipient_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Efficient queries: latest N messages for a stream; private DM lookups
CREATE INDEX IF NOT EXISTS idx_chat_stream
  ON live_chat_messages(stream_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_private
  ON live_chat_messages(recipient_id, created_at DESC)
  WHERE is_private = TRUE;

ALTER TABLE live_chat_messages ENABLE ROW LEVEL SECURITY;

-- Public messages: all authenticated and anonymous can read
CREATE POLICY "chat_public_read" ON live_chat_messages
  FOR SELECT USING (NOT is_private);

-- Private messages: only sender, recipient, or stream creator can read
CREATE POLICY "chat_private_read" ON live_chat_messages
  FOR SELECT USING (
    is_private AND (
      auth.uid() = sender_id
      OR auth.uid() = recipient_id
      OR EXISTS (
        SELECT 1 FROM live_streams
        WHERE id = stream_id AND creator_id = auth.uid()
      )
    )
  );

-- Authenticated users can send public messages as themselves
CREATE POLICY "chat_insert_public" ON live_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND NOT is_private
    AND type = 'message'
  );

-- Authenticated users can send private messages (recipient required)
CREATE POLICY "chat_insert_private" ON live_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND is_private
    AND recipient_id IS NOT NULL
    AND type = 'message'
  );

-- Service role inserts gift_event and system messages (no auth.uid() constraint)
CREATE POLICY "chat_service_all" ON live_chat_messages
  FOR ALL USING (auth.role() = 'service_role');
