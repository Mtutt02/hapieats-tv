-- ============================================================
-- HapiEats TV — Global Foods station
-- July 2026
-- Adds the "Global Foods" station (TV channel 13 + Stations
-- entry + upload target + /global-foods designated section).
-- Additive & idempotent.
-- ============================================================

INSERT INTO stations (slug, name, description, icon, cover_url, theme, follower_count, video_count)
VALUES (
  'global-foods',
  'Global Foods',
  'A world tour on your plate — authentic recipes and street eats from every continent, one region at a time.',
  '🌍',
  'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800&q=80',
  'Global',
  0,
  0
)
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      icon        = EXCLUDED.icon,
      cover_url   = EXCLUDED.cover_url,
      theme       = EXCLUDED.theme;
