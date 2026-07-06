-- ============================================================
-- HapiEats TV — Flavor Points System
-- ============================================================

-- 1. Flavor wallets (user balances)
CREATE TABLE IF NOT EXISTS flavor_wallets (
  user_id     UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Flavor packages (the 6 purchasable bundles)
CREATE TABLE IF NOT EXISTS flavor_packages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  points      INTEGER NOT NULL,
  price_usd   NUMERIC(10,2) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO flavor_packages (id, name, points, price_usd, sort_order) VALUES
  ('starter_bite',  'Starter Bite',  100,    0.99,  1),
  ('snack_pack',    'Snack Pack',    520,    4.99,  2),
  ('full_plate',    'Full Plate',    1100,   9.99,  3),
  ('family_meal',   'Family Meal',   2850,  24.99,  4),
  ('feast_pack',    'Feast Pack',    6000,  49.99,  5),
  ('vip_table',     'VIP Table',    12500,  99.99,  6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  points = EXCLUDED.points,
  price_usd = EXCLUDED.price_usd,
  sort_order = EXCLUDED.sort_order;

-- 3. Gift catalog
CREATE TABLE IF NOT EXISTS flavor_gifts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO flavor_gifts (id, name, emoji, points_cost, sort_order) VALUES
  ('sauce_drop',      'Sauce Drop',      '🫙',  5,     1),
  ('chopsticks',      'Chopsticks',      '🥢',  10,    2),
  ('taco_pop',        'Taco Pop',        '🌮',  25,    3),
  ('ramen_bowl',      'Ramen Bowl',      '🍜',  50,    4),
  ('hapi_plate',      'Hapi Plate',      '🍽️',  100,   5),
  ('bento_box',       'Bento Box',       '🍱',  250,   6),
  ('hibachi_flame',   'Hibachi Flame',   '🔥',  500,   7),
  ('chef_hat',        'Chef Hat',        '👨‍🍳',  1000,  8),
  ('food_truck',      'Food Truck',      '🚚',  5000,  9),
  ('golden_spatula',  'Golden Spatula',  '🥇',  10000, 10)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  points_cost = EXCLUDED.points_cost,
  sort_order = EXCLUDED.sort_order;

-- 4. Flavor purchases (Stripe checkout history)
CREATE TABLE IF NOT EXISTS flavor_purchases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id        TEXT NOT NULL REFERENCES flavor_packages(id),
  points_credited   INTEGER NOT NULL,
  amount_usd        NUMERIC(10,2) NOT NULL,
  stripe_session_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Flavor gift events (gifts sent during streams)
CREATE TABLE IF NOT EXISTS flavor_gift_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id     UUID REFERENCES live_streams(id) ON DELETE SET NULL,
  sender_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gift_id       TEXT NOT NULL REFERENCES flavor_gifts(id),
  points_spent  INTEGER NOT NULL,
  creator_share INTEGER NOT NULL,   -- 50% of points_spent
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Creator flavor earnings (pending/paid)
CREATE TABLE IF NOT EXISTS creator_flavor_earnings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gift_event_id    UUID REFERENCES flavor_gift_events(id) ON DELETE SET NULL,
  points_earned    INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'cashed_out')),
  cashout_id       UUID,  -- FK set when cashed out
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Cashout requests (creator withdrawals)
CREATE TABLE IF NOT EXISTS flavor_cashout_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points_total        INTEGER NOT NULL,
  usd_gross           NUMERIC(10,2) NOT NULL,
  platform_fee_pct    NUMERIC(5,4) NOT NULL DEFAULT 0.05,  -- 5%
  platform_fee_usd    NUMERIC(10,2) NOT NULL,
  usd_net             NUMERIC(10,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  payout_method       TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ
);

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_flavor_wallets_user ON flavor_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_flavor_purchases_user ON flavor_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_flavor_gift_events_sender ON flavor_gift_events(sender_id);
CREATE INDEX IF NOT EXISTS idx_flavor_gift_events_creator ON flavor_gift_events(creator_id);
CREATE INDEX IF NOT EXISTS idx_flavor_gift_events_stream ON flavor_gift_events(stream_id);
CREATE INDEX IF NOT EXISTS idx_creator_flavor_earnings_creator ON creator_flavor_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_flavor_earnings_status ON creator_flavor_earnings(status);
CREATE INDEX IF NOT EXISTS idx_flavor_cashout_requests_creator ON flavor_cashout_requests(creator_id);

-- 9. RLS
ALTER TABLE flavor_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE flavor_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE flavor_gift_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_flavor_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE flavor_cashout_requests ENABLE ROW LEVEL SECURITY;

-- flavor_wallets: user can see own wallet
CREATE POLICY "flavor_wallets_own" ON flavor_wallets
  FOR ALL USING (auth.uid() = user_id);

-- flavor_purchases: user can see own purchases
CREATE POLICY "flavor_purchases_own" ON flavor_purchases
  FOR SELECT USING (auth.uid() = user_id);

-- flavor_gift_events: sender or creator can read
CREATE POLICY "flavor_gift_events_read" ON flavor_gift_events
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = creator_id);

-- creator_flavor_earnings: creator can see own earnings
CREATE POLICY "creator_flavor_earnings_own" ON creator_flavor_earnings
  FOR SELECT USING (auth.uid() = creator_id);

-- flavor_cashout_requests: creator can see own requests
CREATE POLICY "flavor_cashout_requests_own" ON flavor_cashout_requests
  FOR SELECT USING (auth.uid() = creator_id);

-- Public read on packages and gifts catalog
ALTER TABLE flavor_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE flavor_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flavor_packages_public_read" ON flavor_packages FOR SELECT USING (true);
CREATE POLICY "flavor_gifts_public_read" ON flavor_gifts FOR SELECT USING (true);
