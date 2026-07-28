-- ============================================================
-- HapiEats — RLS hardening (audit follow-up)
-- Tightens over-permissive read policies so rosters, assessment
-- definitions, and cohort membership aren't world-readable via
-- the anon key, and locks down view-count inserts. Idempotent.
-- ============================================================

-- ── institution_members: only members of the institution (or its owner) may read the roster ──
DROP POLICY IF EXISTS "inst_members_read" ON public.institution_members;
CREATE POLICY "inst_members_read" ON public.institution_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.institutions i
               WHERE i.id = institution_id AND i.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.institution_members m
               WHERE m.institution_id = institution_members.institution_id
                 AND m.user_id = auth.uid() AND m.role IN ('admin','instructor'))
  );

-- ── assessments: readable by the course creator or enrolled students only ──
DROP POLICY IF EXISTS "assessments_read" ON public.assessments;
CREATE POLICY "assessments_read" ON public.assessments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.courses c
            WHERE c.id = course_id AND c.creator_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.course_enrollments e
               WHERE e.course_id = assessments.course_id AND e.user_id = auth.uid())
  );

-- (cohort_members already restricts to the owner via the FOR ALL "cohort_members_own"
--  policy; cohorts themselves stay publicly listable for the schedule.)

-- ── video_views: only authenticated users may record a view (blocks anon count inflation) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='video_views') THEN
    EXECUTE 'ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "video_views_insert" ON public.video_views';
    EXECUTE $p$CREATE POLICY "video_views_insert" ON public.video_views
             FOR INSERT TO authenticated WITH CHECK (true)$p$;
  END IF;
END $$;
