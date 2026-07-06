-- ──────────────────────────────────────────────────────────────────────────────
-- HapiEats TV — Verified Chef Badge System
-- Run via: supabase db push
-- ──────────────────────────────────────────────────────────────────────────────

-- Add is_verified_chef and role to profiles if not already present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified_chef boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'creator', 'moderator', 'admin', 'superadmin'));

-- ── Chef Verification Applications ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chef_verification_applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'denied')),
  -- Applicant-submitted info
  credential_type   text NOT NULL CHECK (credential_type IN (
                      'culinary_school',
                      'professional_cook',
                      'restaurant_owner',
                      'food_blogger',
                      'certified_nutritionist',
                      'other'
                    )),
  credential_detail text NOT NULL,   -- e.g. "Le Cordon Bleu, Paris 2018"
  portfolio_url     text,            -- link to their work
  social_proof      text,            -- Instagram/YouTube/TikTok handle
  additional_notes  text,
  -- Admin review
  reviewed_by       uuid REFERENCES public.profiles(id),
  reviewed_at       timestamptz,
  denial_reason     text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (user_id)                   -- one application per user
);

ALTER TABLE public.chef_verification_applications ENABLE ROW LEVEL SECURITY;

-- Users can see their own application
CREATE POLICY "Users see own application"
  ON public.chef_verification_applications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can submit their own application
CREATE POLICY "Users submit application"
  ON public.chef_verification_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins/moderators can see all applications
CREATE POLICY "Admins see all"
  ON public.chef_verification_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin', 'moderator')
    )
  );

-- Admins/superadmins can update (approve/deny) applications
CREATE POLICY "Admins update"
  ON public.chef_verification_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
  );

-- Auto-update updated_at on chef_verification_applications
CREATE TRIGGER set_chef_verification_updated_at
  BEFORE UPDATE ON public.chef_verification_applications
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chef_verification_user_id
  ON public.chef_verification_applications(user_id);

CREATE INDEX IF NOT EXISTS idx_chef_verification_status
  ON public.chef_verification_applications(status);
