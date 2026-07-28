-- ============================================================
-- HapiEats TV — Credit Requests
-- Users can submit applications for gift or loan credits.
-- Admins review and approve/deny. Approval auto-grants credits.
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('gift', 'loan')),
  amount        NUMERIC(10,2) NOT NULL CHECK (amount > 0 AND amount <= 500),
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by   UUID REFERENCES auth.users(id),
  review_notes  TEXT,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_requests_user    ON credit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_requests_status  ON credit_requests(status);
CREATE INDEX IF NOT EXISTS idx_credit_requests_created ON credit_requests(created_at DESC);

ALTER TABLE credit_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "credit_requests_own_read" ON credit_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "credit_requests_own_insert" ON credit_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role handles all admin operations (approve/deny/list all)
CREATE POLICY "credit_requests_service_all" ON credit_requests
  FOR ALL USING (auth.role() = 'service_role');
