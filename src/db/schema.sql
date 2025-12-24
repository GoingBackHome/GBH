CREATE TABLE IF NOT EXISTS claims (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claim_signature TEXT NOT NULL UNIQUE,
  fees_claimed_lamports BIGINT NOT NULL,
  fees_claimed_sol NUMERIC(20,9) NOT NULL,
  fixed_wallet TEXT NOT NULL,
  fixed_signature TEXT,
  raffle_signature TEXT,
  mint_address TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  interval_seconds INT NOT NULL,
  dry_run BOOLEAN NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS winners (
  id BIGSERIAL PRIMARY KEY,
  claim_signature TEXT NOT NULL REFERENCES claims(claim_signature) ON DELETE CASCADE,
  rank INT NOT NULL,
  wallet TEXT NOT NULL,
  weight NUMERIC(30,9) NOT NULL,
  balance_raw BIGINT NOT NULL,
  balance_ui NUMERIC(30,9) NOT NULL,
  prize_pct NUMERIC(8,4) NOT NULL,
  prize_lamports BIGINT NOT NULL,
  prize_sol NUMERIC(20,9) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_winners_claim ON winners(claim_signature);
