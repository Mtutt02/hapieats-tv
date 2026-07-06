-- ============================================================
-- HapiEats TV — Stations Migration
-- June 2026
-- ============================================================

-- 1. Stations table
CREATE TABLE IF NOT EXISTS stations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  icon           TEXT,           -- emoji
  cover_url      TEXT,
  theme          TEXT,
  follower_count INTEGER NOT NULL DEFAULT 0,
  video_count    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stations_public_read" ON stations FOR SELECT USING (true);
CREATE POLICY "stations_admin_write" ON stations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. Station followers (users following a station)
CREATE TABLE IF NOT EXISTS station_followers (
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (station_id, user_id)
);

ALTER TABLE station_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "station_followers_public_read" ON station_followers FOR SELECT USING (true);
CREATE POLICY "station_followers_own_write" ON station_followers
  FOR ALL USING (auth.uid() = user_id);

-- 3. Add station_id to videos
ALTER TABLE videos ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES stations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_videos_station ON videos(station_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_station_followers_station ON station_followers(station_id);
CREATE INDEX IF NOT EXISTS idx_station_followers_user ON station_followers(user_id);

-- 5. Seed the 8 default stations
INSERT INTO stations (slug, name, description, icon, cover_url, theme, follower_count, video_count)
VALUES
  ('japanese-kitchen', 'Japanese Kitchen',    'Ramen, sushi, izakaya classics and modern Japanese cooking',          '🍣', 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80', 'Japanese',    48200, 312),
  ('street-food',      'Street Food World',   'Street eats from every corner of the planet',                         '🌮', 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80', 'Street Food', 91000, 541),
  ('bbq',              'BBQ & Smoke',         'Pitmasters, backyard cooks, and the craft of low-and-slow',           '🔥', 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&q=80', 'BBQ',         62400, 228),
  ('baking',           'Baking Lab',          'Bread, pastries, cakes — the science and art of baking',              '🥐', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80', 'Baking',      77100, 390),
  ('italian',          'Italian Table',       'Pasta, pizza, risotto — authentic and modern Italian',                '🍝', 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=800&q=80', 'Italian',     54800, 284),
  ('plant-based',      'Plant-Based Kitchen', 'Vegan and vegetarian recipes that actually excite',                   '🌱', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', 'Plant-Based', 39200, 195),
  ('desserts',         'Dessert Lab',         'Chocolate, ice cream, tarts and everything sweet',                    '🍫', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80', 'Desserts',    83300, 416),
  ('general',          'General Station',     'Everything food — upload anything here if you don''t fit a theme',    '🍽️', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80', 'General',    120000, 1024)
ON CONFLICT (slug) DO NOTHING;

-- 6. Function: increment/decrement station follower count
CREATE OR REPLACE FUNCTION update_station_follower_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE stations SET follower_count = follower_count + 1 WHERE id = NEW.station_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE stations SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.station_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_station_follower_count ON station_followers;
CREATE TRIGGER trg_station_follower_count
  AFTER INSERT OR DELETE ON station_followers
  FOR EACH ROW EXECUTE FUNCTION update_station_follower_count();
