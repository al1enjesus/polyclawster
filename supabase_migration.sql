-- PolyClawster DB Migration
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Extend users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS private_key_enc TEXT,
  ADD COLUMN IF NOT EXISTS total_deposited NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_profit NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_fees_paid NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS demo_balance NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ref_earned NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ref_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pnl NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 2. Bets table
CREATE TABLE IF NOT EXISTS bets (
  id BIGSERIAL PRIMARY KEY,
  tg_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id TEXT,
  market TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('YES','NO')),
  amount NUMERIC NOT NULL,
  price NUMERIC,
  payout NUMERIC,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','won','lost','cancelled')),
  is_demo BOOLEAN DEFAULT false,
  signal_type TEXT,
  signal_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 3. Signals table (persistent history)
CREATE TABLE IF NOT EXISTS signals (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  score NUMERIC NOT NULL,
  market TEXT,
  market_id TEXT,
  token_id TEXT,
  side TEXT,
  price NUMERIC,
  amount NUMERIC,
  news_context TEXT,
  raw JSONB,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, market, side)
);

-- 4. Referrals table
ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS referrer_id BIGINT,
  ADD COLUMN IF NOT EXISTS referee_id BIGINT,
  ADD COLUMN IF NOT EXISTS bonus_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0.40;

-- 5. Payouts queue
CREATE TABLE IF NOT EXISTS payouts (
  id BIGSERIAL PRIMARY KEY,
  tg_id BIGINT NOT NULL REFERENCES users(id),
  amount NUMERIC NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 6. Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  tg_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  private_key_enc TEXT NOT NULL,
  network TEXT DEFAULT 'polygon',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS bets_tg_id_idx ON bets(tg_id);
CREATE INDEX IF NOT EXISTS bets_status_idx ON bets(status);
CREATE INDEX IF NOT EXISTS bets_created_idx ON bets(created_at DESC);
CREATE INDEX IF NOT EXISTS signals_score_idx ON signals(score DESC);
CREATE INDEX IF NOT EXISTS signals_detected_idx ON signals(detected_at DESC);

-- 8. Row Level Security (users see only their data)
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — all our API calls use service role key, so this is fine

-- Done!
SELECT 'Migration complete ✅' as status;

-- Agents leaderboard table (run in Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS agents (
  id BIGSERIAL PRIMARY KEY,
  owner_tg_id BIGINT REFERENCES users(id),
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🤖',
  strategy TEXT,
  polygon_address TEXT,
  api_key TEXT,
  total_pnl NUMERIC DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  total_bets INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agents_pnl_idx ON agents(total_pnl DESC);
CREATE INDEX IF NOT EXISTS agents_owner_idx ON agents(owner_tg_id);
