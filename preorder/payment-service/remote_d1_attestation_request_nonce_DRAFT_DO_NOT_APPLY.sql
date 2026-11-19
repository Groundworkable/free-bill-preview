-- ISOLATED PAYMENT D1 ONLY. TEST-ONLY. DRAFT / DO NOT APPLY REMOTELY.
-- Additive one-time internal request replay ledger; no customer, Stripe or
-- account data. No route in the deployed Worker imports this handler.
--
-- Each valid, authenticated internal POST must atomically claim its random
-- 256-bit nonce before the Stripe/D1 financial verification can begin.
-- A request whose nonce is already present, even during a concurrent race,
-- cannot run the financial verifier again.
--
-- Deliberately append-only. Tiny founder-only TEST traffic is acceptable;
-- a separately reviewed bounded-retention policy is required before scaling.
CREATE TABLE IF NOT EXISTS prepurchase_attestation_request_nonces (
  nonce_hex TEXT PRIMARY KEY NOT NULL
    CHECK(length(nonce_hex)=64 AND nonce_hex NOT GLOB '*[^0-9a-f]*'),
  request_timestamp INTEGER NOT NULL
    CHECK(typeof(request_timestamp)='integer' AND request_timestamp>0),
  accepted_at INTEGER NOT NULL DEFAULT (unixepoch())
    CHECK(typeof(accepted_at)='integer' AND accepted_at>0),
  CHECK(abs(accepted_at-request_timestamp)<=30)
);

CREATE INDEX IF NOT EXISTS idx_attestation_nonce_accepted_at
  ON prepurchase_attestation_request_nonces(accepted_at);

CREATE TRIGGER IF NOT EXISTS attestation_nonce_block_update
BEFORE UPDATE ON prepurchase_attestation_request_nonces
BEGIN
  SELECT RAISE(ABORT,'attestation replay ledger is append-only');
END;

CREATE TRIGGER IF NOT EXISTS attestation_nonce_block_delete
BEFORE DELETE ON prepurchase_attestation_request_nonces
BEGIN
  SELECT RAISE(ABORT,'attestation replay ledger is append-only');
END;
