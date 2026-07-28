-- ============================================================
-- HapiEats TV — App Credits System
-- Supports gift credits (no repayment) and loan credits (must repay)
-- Creator payout: only real Stripe cash reaches creator (credits = $0 to creator)
-- Loan repayment: auto-deducted from creator cashouts + manual Stripe payment
-- ============================================================

-- 1. app_credits: one row per user, tracks balances
CREATE TABLE IF NOT EXISTS app_credits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  gift_balance    NUMERIC(10,2) NOT NULL DEFAULT 0,   -- free credits, no repayment required
  loan_balance    NUMERIC(10,2) NOT NULL DEFAULT 0,   -- borrowed credits, must repay
  loan_repaid     NUMERIC(10,2) NOT NULL DEFAULT 0,   -- cumulative amount repaid
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT positive_gift CHECK (gift_balance >= 0),
  CONSTRAINT positive_loan CHECK (loan_balance >= 0),
  CONSTRAINT positive_repaid CHECK (loan_repaid >= 0)
);

-- 2. credit_grants: log of every admin-issued credit grant
CREATE TABLE IF NOT EXISTS credit_grants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  granted_by  UUID REFERENCES auth.users(id) NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('gift', 'loan')),
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  notes       TEXT,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. credit_ledger: full immutable transaction history
CREATE TABLE IF NOT EXISTS credit_ledger (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_type          TEXT NOT NULL CHECK (entry_type IN (
                        'grant_gift',           -- admin gave free credits
                        'grant_loan',           -- admin issued a loan
                        'spend_gift',           -- credits used for purchase (gift portion)
                        'spend_loan',           -- credits used for purchase (loan portion)
                        'repay_loan_earnings',  -- loan repaid from creator cashout
                        'repay_loan_manual',    -- loan repaid via Stripe
                        'expire_gift'           -- unused gift credits expired
                      )),
  amount              NUMERIC(10,2) NOT NULL,           -- always positive
  gift_balance_after  NUMERIC(10,2) NOT NULL,
  loan_balance_after  NUMERIC(10,2) NOT NULL,
  reference_id        TEXT,          -- e.g. video_id, cashout_id, stripe_session_id
  reference_type      TEXT,          -- 'ppv', 'flavor', 'cashout', 'stripe_repay'
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_app_credits_user ON app_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_grants_user ON credit_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_grants_granted_by ON credit_grants(granted_by);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_type ON credit_ledger(entry_type);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created ON credit_ledger(created_at DESC);

-- 5. updated_at trigger for app_credits
CREATE OR REPLACE FUNCTION update_app_credits_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_credits_updated_at ON app_credits;
CREATE TRIGGER app_credits_updated_at
  BEFORE UPDATE ON app_credits
  FOR EACH ROW EXECUTE FUNCTION update_app_credits_updated_at();

-- 6. RLS
ALTER TABLE app_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

-- app_credits: user can read own balance; service_role handles all writes
CREATE POLICY "app_credits_own_read" ON app_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "app_credits_service_write" ON app_credits
  FOR ALL USING (auth.role() = 'service_role');

-- credit_grants: user can read own grants; admins can read all
CREATE POLICY "credit_grants_own_read" ON credit_grants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "credit_grants_service_all" ON credit_grants
  FOR ALL USING (auth.role() = 'service_role');

-- credit_ledger: user can read own history; service_role writes
CREATE POLICY "credit_ledger_own_read" ON credit_ledger
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "credit_ledger_service_write" ON credit_ledger
  FOR ALL USING (auth.role() = 'service_role');

-- 7. Add loan_deducted column to flavor_cashout_requests to track auto-repayment
ALTER TABLE flavor_cashout_requests
  ADD COLUMN IF NOT EXISTS loan_deducted_usd NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 8. Allow credit-funded purchases to have null stripe_payment_intent_id
--    and add credit_funded flag to purchases table
ALTER TABLE purchases
  ALTER COLUMN stripe_payment_intent_id DROP NOT NULL;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS credit_funded BOOLEAN NOT NULL DEFAULT false;
