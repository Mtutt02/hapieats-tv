-- ──────────────────────────────────────────────────────────────────────────────
-- HapiEats TV — Recipe Cards, Tried This, Verified Chef
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Recipe Cards ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id            uuid REFERENCES videos(id) ON DELETE CASCADE,
  creator_id          uuid REFERENCES profiles(id),
  title               text NOT NULL,
  description         text,
  prep_time_minutes   int,
  cook_time_minutes   int,
  servings            int,
  difficulty          text CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  cuisine_type        text,
  dietary_tags        text[],  -- e.g. ['vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo']
  ingredients         jsonb,   -- [{"amount": "2", "unit": "cups", "item": "flour"}]
  steps               jsonb,   -- [{"step": 1, "instruction": "Preheat oven..."}]
  calories_per_serving int,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE recipe_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON recipe_cards
  FOR SELECT USING (true);

CREATE POLICY "Creators manage own" ON recipe_cards
  FOR ALL USING (auth.uid() = creator_id);

-- ── Tried This ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tried_this (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (video_id, user_id)
);

ALTER TABLE tried_this ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tried_this" ON tried_this
  FOR SELECT USING (true);

CREATE POLICY "Users manage own tried_this" ON tried_this
  FOR ALL USING (auth.uid() = user_id);

-- ── Verified Chef flag on profiles ────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_verified_chef boolean DEFAULT false;
