# Founder-approved isolated D1 review-evidence migration — execution handoff

**Approval:** founder explicitly authorized installing the five new review-evidence database objects in **Cloudflare D1 `groundwork-payment-sandbox-isolated` only**, without payment/provider activation, new Worker deployment, or changes to the public site.

**Prepared, not yet executed remotely.** This migration creates exactly **one table and four triggers**. SQL is comment-free because the Cloudflare D1 Console has previously mis-parsed SQL comments. No data is inserted; existing order, notification, and journal rows are not deliberately altered.

## Execution gate (Cloudflare Console, founder-controlled)

1. Confirm database name **`groundwork-payment-sandbox-isolated`** in **Workers & Pages → D1 → Console**. This is not the app, production, or Supabase database.
2. Run the SELECT-only `remote_d1_review_evidence_preflight_2026-11-15.sql`. Expect **five `MISSING`** statuses on a fresh database. If any are already `PRESENT`, stop and reconcile definitions before running a migration; do not assume an empty or partial schema.
3. With complete preflight results and green GitHub Actions workflow run for the migration test, copy the **Raw** text of `remote_d1_review_evidence_additive_migration_2026-11-15.sql` and execute **once** in the same isolated D1 Console. A no-data result is expected for DDL; SQL errors require investigation, not blind re-execution.
4. Run `remote_d1_review_evidence_postcheck_2026-11-15.sql` (SELECT-only). Expect **five `KEY_CLAUSES_FOUND`** statuses. This is a selected-clause schema check; a native remote synthetic behavioral test would require a distinct, approved authorization.
5. **Do not** run any INSERT/UPDATE/DELETE to verify this migration. Keep the existing synthetic D1 guard test record in `manual_review`; it cannot become a reviewed/sent notice.

## Safety and recovery

- Script uses `CREATE ... IF NOT EXISTS`; it does not contain DROP, ALTER, UPDATE, INSERT or DELETE. It still changes the remote schema, so a founder screenshot of the read-only preflight is the required final checkpoint before execution.
- Four new triggers enforce append-only review evidence and prohibit `review_verified` without a matching, preexisting signed-evidence row.
- An interrupted migration may leave a **partial set** of schema objects; if the console reports errors or the postcheck reports missing items, **STOP**, inspect installed objects and resolve the discrepancy. Do not delete existing objects or replay blindly.
- The founder-only notification Worker and review module remain **draft and undeployed**. No real Access policy or operator credentials have been configured.
- Stripe test Payment Links/webhook remain disabled, all Resend templates unpublished, public checkout disabled, and Draft PR #17 unmerged. No actual payments, refunds, notices or customer email activity is authorized by this migration.
