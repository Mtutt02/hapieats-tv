-- Community posting control for user-created channels.
-- Additive only: channel owners can allow/disallow other creators posting to their channel.
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS open_posting BOOLEAN NOT NULL DEFAULT false;
