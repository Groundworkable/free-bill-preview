-- Groundwork isolated D1 payment sandbox: additive migration only.
-- Based on founder-run read-only audit, November 14 2026:
-- PRESENT: prepurchase_orders, stripe_processed_events.
-- MISSING: prepurchase_payment_changes and four append-only triggers.
--
-- Run ONLY against D1 database groundwork-payment-sandbox-isolated.
-- Never run against the production Groundwork database.
-- Do not enable checkout, payment links, or Stripe webhooks from this migration.
--
-- This does not alter, delete, or recreate the two existing purchase/event tables.
-- IF NOT EXISTS allows a safe rerun after a partial execution.
-- Remote execution must be followed by remote_d1_readonly_audit.sql.

CREATE TABLE IF NOT EXISTS prepurchase_payment_changes (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'refund.created', 'refund.updated', 'refund.failed',
    'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed'
  )),
  object_id TEXT NOT NULL,
  charge_id TEXT,
  payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL CHECK (currency = 'usd'),
  financial_status TEXT NOT NULL CHECK (length(financial_status) BETWEEN 1 AND 48),
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_change_intent
  ON prepurchase_payment_changes(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_change_object
  ON prepurchase_payment_changes(object_id);

CREATE TRIGGER IF NOT EXISTS prepurchase_changes_block_update
BEFORE UPDATE ON prepurchase_payment_changes
BEGIN
  SELECT RAISE(ABORT, 'payment-change journal is append-only');
END;

CREATE TRIGGER IF NOT EXISTS prepurchase_changes_block_delete
BEFORE DELETE ON prepurchase_payment_changes
BEGIN
  SELECT RAISE(ABORT, 'payment-change journal is append-only');
END;

CREATE TRIGGER IF NOT EXISTS prepurchase_orders_block_update
BEFORE UPDATE ON prepurchase_orders
BEGIN
  SELECT RAISE(ABORT, 'prepurchase orders are append-only');
END;

CREATE TRIGGER IF NOT EXISTS prepurchase_orders_block_delete
BEFORE DELETE ON prepurchase_orders
BEGIN
  SELECT RAISE(ABORT, 'prepurchase orders are append-only');
END;
