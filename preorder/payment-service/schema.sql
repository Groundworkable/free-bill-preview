-- Separate SANDBOX D1 database ONLY. Never apply to existing Groundwork production DB.
CREATE TABLE IF NOT EXISTS stripe_processed_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  checkout_session_id TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prepurchase_orders (
  checkout_session_id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  payment_link_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  term TEXT NOT NULL CHECK (term IN ('monthly','annual')),
  terms_version TEXT NOT NULL CHECK (length(terms_version) = 23 AND substr(terms_version,1,13) = 'prepurchase-v'),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents > 0),
  tax_cents INTEGER NOT NULL CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents = subtotal_cents + tax_cents),
  currency TEXT NOT NULL CHECK (currency = 'usd'),
  status TEXT NOT NULL CHECK (status = 'paid_unfulfilled'),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prepurchase_intent ON prepurchase_orders(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_prepurchase_customer ON prepurchase_orders(stripe_customer_id);
