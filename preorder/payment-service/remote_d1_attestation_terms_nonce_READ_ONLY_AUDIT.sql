-- GROUNDWORK / PRIVATE TEST VERIFIER -- READ ONLY, REVIEW ONLY
-- Isolated Cloudflare D1 database ONLY:
--   groundwork-payment-sandbox-isolated
--   f37839b6-3ed4-4a73-89d7-b6cd6aef6125
-- No DDL, migrations, secrets, email, account, claims or membership activity.
-- Never run against production. The first two queries inspect only object
-- metadata. The final query returns only a matching-row count and Terms
-- version; no customer contact, Stripe IDs, checkout ID or payment data.
-- The historical founder TEST Checkout ID and TEST offer IDs below were
-- already recorded in the existing app/payment draft source.
-- This query MUST NOT be used as authorization to enable a verifier.
--
-- Query 1: nonce replay-ledger schema objects (missing is a STOP, NOT a
-- request to apply remote_d1_attestation_request_nonce_DRAFT_DO_NOT_APPLY.sql).
WITH required(kind, object_name) AS (
  VALUES
    ('table',   'prepurchase_attestation_request_nonces'),
    ('index',   'idx_attestation_nonce_accepted_at'),
    ('trigger', 'attestation_nonce_block_update'),
    ('trigger', 'attestation_nonce_block_delete')
)
SELECT 'nonce_schema' AS audit_area,
       required.kind,
       required.object_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM sqlite_master AS s
          WHERE s.type = required.kind
            AND s.name = required.object_name
       ) THEN 'PRESENT' ELSE 'MISSING' END AS status
FROM required
ORDER BY required.kind, required.object_name;

-- Query 2: nonce ledger column shape, including primary-key enforcement.
WITH required(column_name, required_type, needs_pk) AS (
  VALUES
    ('nonce_hex', 'TEXT', 1),
    ('request_timestamp', 'INTEGER', 0),
    ('accepted_at', 'INTEGER', 0)
)
SELECT 'nonce_columns' AS audit_area,
       required.column_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM pragma_table_info('prepurchase_attestation_request_nonces') AS p
          WHERE p.name = required.column_name
            AND upper(p.type) = required.required_type
            AND p."notnull" = 1
            AND (required.needs_pk = 0 OR p.pk = 1)
       ) THEN 'PRESENT' ELSE 'MISSING' END AS status
FROM required
ORDER BY required.column_name;

-- Query 3: exact founder-owned historical Stripe TEST Checkout only.
-- Restrict to previously verified TEST $9.99 monthly offer, $0.90 TEST tax,
-- immutable paid_unfulfilled row. Never print buyer email, checkout id,
-- payment intent, charge ID, nor raw row. Missing/ambiguous = NOT_VERIFIED.
-- D1 console rejected the previous digit-class GLOB as a complex pattern.
-- Instead use basic SQLite length/substr tests, which check the recorded
-- version's outer shape without inventing a Terms date. Application-side
-- validation must still reject malformed digits or dates.
SELECT 'original_test_terms' AS audit_area,
       COUNT(*) AS matching_order_count,
       CASE
         WHEN COUNT(*) = 1
          AND length(MIN(terms_version)) = 23
          AND substr(MIN(terms_version),1,13) = 'prepurchase-v'
          AND substr(MIN(terms_version),18,1) = '-'
          AND substr(MIN(terms_version),21,1) = '-'
         THEN MIN(terms_version)
         ELSE 'NOT_VERIFIED'
       END AS terms_version_result
FROM prepurchase_orders
WHERE checkout_session_id = 'cs_test_a0wyfpMSTBjf3jPB2IktXBafoR3mMkHO7cjwNnEGG0WurnPxo8BPBRuirZ'
  AND payment_link_id = 'plink_1UbK33JK9stEim4w7BvY2CnM'
  AND stripe_price_id = 'price_1UbK2YJK9stEim4wCsZ0tyao'
  AND term = 'monthly'
  AND subtotal_cents = 999
  AND tax_cents = 90
  AND total_cents = 1089
  AND currency = 'usd'
  AND status = 'paid_unfulfilled';
