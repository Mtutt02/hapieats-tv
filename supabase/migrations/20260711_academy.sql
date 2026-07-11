-- ============================================================
-- HapiEats Academy — Comprehensive classes/courses platform
-- Skillshare-style structure + cooking enrichments + Pro
-- subscription revenue-share + institutions/accreditation.
-- Built on the existing `courses` spine (courses → sections →
-- lessons → enrollments). Additive & idempotent.
-- ============================================================

-- ── 1. Extend courses ──────────────────────────────────────
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS format            TEXT NOT NULL DEFAULT 'recorded'
    CHECK (format IN ('recorded','live','hybrid')),
  ADD COLUMN IF NOT EXISTS level             TEXT NOT NULL DEFAULT 'beginner'
    CHECK (level IN ('beginner','intermediate','advanced','professional')),
  ADD COLUMN IF NOT EXISTS pricing_model     TEXT NOT NULL DEFAULT 'free'
    CHECK (pricing_model IN ('free','paid','pro_only')),
  ADD COLUMN IF NOT EXISTS price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_price_id   TEXT,
  ADD COLUMN IF NOT EXISTS pro_included      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS issues_certificate BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS certificate_tier  TEXT NOT NULL DEFAULT 'completion'
    CHECK (certificate_tier IN ('completion','skill','diploma')),
  ADD COLUMN IF NOT EXISTS requires_assessment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS institution_id    UUID,
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS enrollment_count  INTEGER NOT NULL DEFAULT 0;

-- ── 2. Extend course_lessons (recipe + resources + chapters) ─
ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS resources  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{name,url,type}]
  ADD COLUMN IF NOT EXISTS chapters   JSONB NOT NULL DEFAULT '[]'::jsonb;  -- [{t,label}]

-- ── 3. Recipes (one per lesson; course-level master when lesson_id null) ─
CREATE TABLE IF NOT EXISTS public.lesson_recipes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id    UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  is_master    BOOLEAN NOT NULL DEFAULT false,
  servings     INTEGER,
  prep_minutes INTEGER,
  cook_minutes INTEGER,
  ingredients  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{item,qty,unit,note}]
  steps        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ["...", "..."]
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lesson_recipes_course ON public.lesson_recipes (course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_recipes_lesson ON public.lesson_recipes (lesson_id);
ALTER TABLE public.lesson_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lesson_recipes_read" ON public.lesson_recipes;
CREATE POLICY "lesson_recipes_read" ON public.lesson_recipes FOR SELECT USING (true);
DROP POLICY IF EXISTS "lesson_recipes_owner" ON public.lesson_recipes;
CREATE POLICY "lesson_recipes_owner" ON public.lesson_recipes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.creator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.creator_id = auth.uid()));

-- ── 4. Shopping list check state (list itself is derived from recipes) ─
CREATE TABLE IF NOT EXISTS public.shopping_checklist (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  item_key   TEXT NOT NULL,
  checked    BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id, item_key)
);
ALTER TABLE public.shopping_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shopping_checklist_own" ON public.shopping_checklist;
CREATE POLICY "shopping_checklist_own" ON public.shopping_checklist FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 5. Certificates / completion ────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id         UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  tier              TEXT NOT NULL DEFAULT 'completion'
    CHECK (tier IN ('completion','skill','diploma')),
  serial            TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  accreditation     TEXT,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked           BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, course_id, tier)
);
CREATE INDEX IF NOT EXISTS idx_certs_user ON public.course_certificates (user_id);
ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "certs_public_read" ON public.course_certificates;
CREATE POLICY "certs_public_read" ON public.course_certificates FOR SELECT USING (true); -- verifiable

-- ── 6. Pro (all-access) subscriptions ───────────────────────
CREATE TABLE IF NOT EXISTS public.pro_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','canceled','past_due','trialing')),
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.pro_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pro_sub_own_read" ON public.pro_subscriptions;
CREATE POLICY "pro_sub_own_read" ON public.pro_subscriptions FOR SELECT USING (auth.uid() = user_id);
-- writes are service-role only (Stripe webhook)

-- ── 7. Engagement ledger — powers the Pro creator pool split ─
-- One row per (user, lesson) accumulating watch minutes + completion.
CREATE TABLE IF NOT EXISTS public.academy_engagement (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  creator_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id    UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  month        TEXT NOT NULL,                 -- 'YYYY-MM'
  minutes      NUMERIC(10,2) NOT NULL DEFAULT 0,
  completed    BOOLEAN NOT NULL DEFAULT false,
  via_pro      BOOLEAN NOT NULL DEFAULT false, -- only Pro-sourced engagement pays from the pool
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id, month)
);
CREATE INDEX IF NOT EXISTS idx_engagement_month ON public.academy_engagement (month, creator_id);
ALTER TABLE public.academy_engagement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "engagement_own_read" ON public.academy_engagement;
CREATE POLICY "engagement_own_read" ON public.academy_engagement FOR SELECT USING (auth.uid() = user_id);
-- writes service-role only

-- ── 8. Pro payout pool + creator earnings from it ───────────
CREATE TABLE IF NOT EXISTS public.pro_payout_pool (
  month           TEXT PRIMARY KEY,           -- 'YYYY-MM'
  gross_cents     BIGINT NOT NULL DEFAULT 0,  -- net Pro sub revenue for the month
  pool_cents      BIGINT NOT NULL DEFAULT 0,  -- creator share of it (POOL_PCT)
  total_credits   NUMERIC(14,2) NOT NULL DEFAULT 0,
  distributed     BOOLEAN NOT NULL DEFAULT false,
  distributed_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_payout_pool ENABLE ROW LEVEL SECURITY; -- service-role only

CREATE TABLE IF NOT EXISTS public.pro_pool_earnings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,
  credits     NUMERIC(14,2) NOT NULL DEFAULT 0,
  cents       BIGINT NOT NULL DEFAULT 0,
  paid        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id, month)
);
CREATE INDEX IF NOT EXISTS idx_pool_earnings_creator ON public.pro_pool_earnings (creator_id);
ALTER TABLE public.pro_pool_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pool_earnings_own_read" ON public.pro_pool_earnings;
CREATE POLICY "pool_earnings_own_read" ON public.pro_pool_earnings FOR SELECT USING (auth.uid() = creator_id);

-- ── 9. Institutions (white-label microsites) ────────────────
CREATE TABLE IF NOT EXISTS public.institutions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  tagline             TEXT,
  about               TEXT,
  logo_url            TEXT,
  cover_url           TEXT,
  theme               JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {primary,accent,font}
  accreditation_body  TEXT,
  is_verified         BOOLEAN NOT NULL DEFAULT false,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_institutions_slug ON public.institutions (slug);
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "institutions_public_read" ON public.institutions;
CREATE POLICY "institutions_public_read" ON public.institutions FOR SELECT USING (true);
DROP POLICY IF EXISTS "institutions_owner" ON public.institutions;
CREATE POLICY "institutions_owner" ON public.institutions FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.institution_members (
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('admin','instructor','student')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, user_id)
);
ALTER TABLE public.institution_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inst_members_read" ON public.institution_members;
CREATE POLICY "inst_members_read" ON public.institution_members FOR SELECT USING (true);

-- ── 10. Programs (multi-course tracks → credentials) ────────
CREATE TABLE IF NOT EXISTS public.programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  slug            TEXT,
  description     TEXT,
  credential_tier TEXT NOT NULL DEFAULT 'skill'
    CHECK (credential_tier IN ('completion','skill','diploma')),
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "programs_read" ON public.programs;
CREATE POLICY "programs_read" ON public.programs FOR SELECT USING (true);
DROP POLICY IF EXISTS "programs_owner" ON public.programs;
CREATE POLICY "programs_owner" ON public.programs FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.program_courses (
  program_id  UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  required    BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (program_id, course_id)
);
ALTER TABLE public.program_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "program_courses_read" ON public.program_courses;
CREATE POLICY "program_courses_read" ON public.program_courses FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.program_enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'active',
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, user_id)
);
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "program_enroll_own" ON public.program_enrollments;
CREATE POLICY "program_enroll_own" ON public.program_enrollments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 11. Live cohorts (scheduled group classes) ──────────────
CREATE TABLE IF NOT EXISTS public.cohorts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  capacity      INTEGER,
  live_stream_id UUID REFERENCES public.live_streams(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','live','ended','canceled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cohorts_course ON public.cohorts (course_id, starts_at);
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cohorts_read" ON public.cohorts;
CREATE POLICY "cohorts_read" ON public.cohorts FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.cohort_members (
  cohort_id  UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, user_id)
);
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cohort_members_own" ON public.cohort_members;
CREATE POLICY "cohort_members_own" ON public.cohort_members FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 12. Assessments + submissions (human-graded) ────────────
CREATE TABLE IF NOT EXISTS public.assessments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id      UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'quiz'
    CHECK (type IN ('quiz','practical')),
  title          TEXT NOT NULL,
  instructions   TEXT,
  config         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- quiz: {questions:[...]}
  pass_threshold INTEGER NOT NULL DEFAULT 70,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assessments_course ON public.assessments (course_id);
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assessments_read" ON public.assessments;
CREATE POLICY "assessments_read" ON public.assessments FOR SELECT USING (true);
DROP POLICY IF EXISTS "assessments_owner" ON public.assessments;
CREATE POLICY "assessments_owner" ON public.assessments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.creator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.creator_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.assessment_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers       JSONB,                              -- quiz answers
  video_id      UUID REFERENCES public.videos(id) ON DELETE SET NULL,  -- practical submission
  status        TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','passed','failed')),
  score         INTEGER,
  grader_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feedback      TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_submissions_assessment ON public.assessment_submissions (assessment_id, status);
ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "submissions_own" ON public.assessment_submissions;
CREATE POLICY "submissions_own" ON public.assessment_submissions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "submissions_grader_read" ON public.assessment_submissions;
CREATE POLICY "submissions_grader_read" ON public.assessment_submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.assessments a JOIN public.courses c ON c.id = a.course_id
                 WHERE a.id = assessment_id AND c.creator_id = auth.uid()));

-- ── 13. Program/accredited credentials (verifiable) ─────────
CREATE TABLE IF NOT EXISTS public.credentials (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id            UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  course_id             UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  institution_id        UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  tier                  TEXT NOT NULL DEFAULT 'skill'
    CHECK (tier IN ('completion','skill','diploma')),
  title                 TEXT NOT NULL,
  serial                TEXT NOT NULL UNIQUE,
  verification_code     TEXT NOT NULL UNIQUE,
  accreditation_partner TEXT,
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked               BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_credentials_user ON public.credentials (user_id);
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credentials_public_read" ON public.credentials;
CREATE POLICY "credentials_public_read" ON public.credentials FOR SELECT USING (true);

-- ── 14. Atomic enrollment-count bump (used on enroll) ───────
CREATE OR REPLACE FUNCTION public.bump_course_enrollment(p_course_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.courses SET enrollment_count = enrollment_count + 1 WHERE id = p_course_id;
$$;
REVOKE ALL ON FUNCTION public.bump_course_enrollment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_course_enrollment(UUID) TO authenticated, service_role;

-- ── 15. Pro membership check (used by access gates) ─────────
CREATE OR REPLACE FUNCTION public.is_pro_member(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pro_subscriptions
    WHERE user_id = p_user_id AND status IN ('active','trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_pro_member(UUID) TO authenticated, service_role, anon;

-- ── 16. Legacy column compatibility ────────────────────────
-- The live courses/course_lessons tables predate the Academy contract and use
-- status/price_usd/position/is_preview. Add the contract-named columns, backfill
-- them, and keep both in sync with triggers so legacy and Academy code coexist.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
UPDATE public.courses SET is_published = (status = 'published') WHERE is_published IS DISTINCT FROM (status = 'published');
UPDATE public.courses SET price = COALESCE(price_usd, 0) WHERE price = 0 AND price_usd IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_course_publish() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.is_published IS DISTINCT FROM OLD.is_published THEN
    NEW.status := CASE WHEN NEW.is_published THEN 'published' ELSE COALESCE(NULLIF(NEW.status,'published'),'draft') END;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_published := (NEW.status = 'published');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_course_publish ON public.courses;
CREATE TRIGGER trg_sync_course_publish BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.sync_course_publish();

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS order_index INTEGER,
  ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN;
UPDATE public.course_lessons SET order_index = COALESCE(order_index, position, 0);
UPDATE public.course_lessons SET is_free_preview = COALESCE(is_free_preview, is_preview, false);

CREATE OR REPLACE FUNCTION public.sync_lesson_compat() RETURNS trigger AS $$
BEGIN
  NEW.order_index := COALESCE(NEW.order_index, NEW.position, 0);
  NEW.position := COALESCE(NEW.position, NEW.order_index, 0);
  NEW.is_free_preview := COALESCE(NEW.is_free_preview, NEW.is_preview, false);
  NEW.is_preview := COALESCE(NEW.is_preview, NEW.is_free_preview, false);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_lesson_compat ON public.course_lessons;
CREATE TRIGGER trg_sync_lesson_compat BEFORE INSERT OR UPDATE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.sync_lesson_compat();
