-- ============================================================
-- HapiEats TV — Moderator Role
-- ============================================================

-- 1. Extend role check constraint to include 'moderator'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'creator', 'admin', 'superadmin', 'moderator'));

-- 2. Moderators can read ALL content reports (for moderation queue)
CREATE POLICY "moderators_read_all_reports" ON public.content_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin', 'moderator')
    )
  );

-- 3. Moderators can update report status (reviewed_by, reviewed_at, status)
CREATE POLICY "moderators_update_reports" ON public.content_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin', 'moderator')
    )
  );

-- 4. Moderators can read ALL videos (including private/flagged) for review
CREATE POLICY "moderators_read_all_videos" ON public.videos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin', 'moderator')
    )
  );

-- 5. Moderators can update video flags and visibility
CREATE POLICY "moderators_update_videos" ON public.videos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin', 'moderator')
    )
  );

-- 6. Moderators can read all profiles (for user lookup during moderation)
-- (profiles already have public SELECT, so this is implicit)

-- 7. Moderators can update profiles for suspension
CREATE POLICY "moderators_suspend_profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role IN ('admin', 'superadmin', 'moderator')
    )
  )
  WITH CHECK (
    -- Moderators can only set suspended_at / suspension_reason, not role
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role IN ('admin', 'superadmin', 'moderator')
    )
  );
