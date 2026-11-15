# Isolated remote payment/notification sandbox — controlled handoff

**Checkpoint:** November 15, 2026. **Approval status:** preparation and READ-ONLY safety verification only. No authorization to run a remote D1 migration, enable Stripe test Payment Links or webhook, publish Resend templates, send transactional emails, issue refunds or deploy a new Worker.

## Verified facts and evidence

- GitHub Actions workflow run [43707265064](https://github.com/Groundworkable/free-bill-preview/actions/runs/43707265064), head `7ee3dda`, completed **successfully**. Its jobs `remote-worker-fail-closed` (#132790931178) and `notification-safe-tests` (#132790931490) both succeeded. The remote safety log explicitly reported: `PASS: isolated deployed Worker rejects payment requests while disabled and does not expose local test routes`. This demonstrates no public local test routes exposed by that probe and refusal of an unsigned webhook while disabled; it does **not** attest to the exact deployed source hash, bindings, real provider event processing or database data.
- Connected Stripe account is Able Systems LLC **test mode only**. Monthly and annual one-time Payment Links remain `active=false`, `consent_collection=null`; webhook `we_1UbShUJK9stEim4wVJZvDGVz` remains `disabled` despite eight configured checkout/refund/dispute event types. Neither a real charge nor a test Checkout Session was established by this audit.
- Resend `groundworkbyable.com` sending domain is verified and sending-enabled, but its three transactional notification templates remain **draft/unpublished**. Previously founder-controlled test emails delivered successfully, but they were manual simulations, not webhook-triggered sends.
- Founder previously verified seven original payment tables/triggers in **isolated** remote D1. The new notification ledger in `notification_ledger.draft.sql` has only been validated in local Workerd/SQLite and has **not** been reported migrated to remote D1.
- `preorder/checkout-config.json` remains disabled with no public payment-link URLs.

## Read-only isolated D1 inventory (founder action, safe to run)

1. In Cloudflare dashboard, go to **Workers & Pages → D1 → groundwork-payment-sandbox-isolated**. Confirm the exact isolated database name; do not select an application, production or Supabase database.
2. Select **Console**, paste ONLY the SQL in `preorder/payment-service/remote_sandbox_readonly_schema_audit.sql` from this PR branch. This performs a `SELECT` from `sqlite_master`; it does not modify records or reveal customer/order information.
3. Record the resulting `PRESENT` / `MISSING` rows. The seven existing payment objects should be present based on the prior founder screenshot. **The ten draft notification objects are expected MISSING until a separately approved remote migration.** Do not mistake expected missing items for a failed migration.
4. Do not run `schema.sql`, `notification_ledger.draft.sql`, any test-only `/__test/*` route, or an `INSERT`, `UPDATE`, `DELETE` or `DROP` command in remote D1 during this audit. Do not paste secrets or customer details.

## Remote sandbox integration release gate — NOT YET AUTHORIZED

The local Workerd tests exercise signed *synthetic* Stripe events → local D1 → manually reviewed outbox → *mocked* Resend and prevent duplicate sends. They are not a remote provider integration result.

Before any separately approved remote integration test:

1. Independently verify isolated deployed `worker.mjs` matches the reviewed source, exact `DB` binding targets only `groundwork-payment-sandbox-isolated`, and Cloudflare text bindings still include `PAYMENTS_MODE=disabled`, `TERMS_APPROVED=false`, `TERMS_VERSION=UNAPPROVED`. Do not disclose Stripe or Resend secrets.
2. Review and expressly approve the migration of ONLY `notification_ledger.draft.sql` to the isolated remote database **after** reconciling object inventory, migration behavior, and rollback/recovery constraints. The ledger's update/delete-blocking triggers are intentionally append-only; do not test with real customer data.
3. Establish safe provider identity and support rules: Stripe test receipts, recipient confirmation independent of claimant-supplied email, dedicated sender/test allowlist, operator approval that is not merely a test environment variable, HMAC key handling, reviewable delivery-copy approval and provider-side idempotency/reconciliation. The current draft notification sender/adapter has **no deployed route** and must not be deployed with local-only test endpoints.
4. Complete separately reviewed customer-facing terms and privacy publication, hosted Stripe consent collection, tax/registration determination, and refund/delay support operations. A verified Stripe Tax settings state does not establish a tax registration. Draft Resend templates must stay unpublished until explicitly approved for a bounded founder-only test.
5. Define a specific start/stop window and explicit written activation/rollback authority. Enable neither inactive Stripe test Payment Links nor the disabled webhook merely to perform a schema inventory. If a future signed remote test event is approved, it must have a verified isolated destination, controlled test-mode credentials, test-only purchaser, expected D1 rows, deterministic duplicate handling, optional audited refund path, and immediately documented shutdown/rollback.
6. After any future authorized isolated change, rerun `remote_fail_closed_smoke.py` while the disabled flags remain in place, confirm the full safety gate, and check the original public site and app are untouched.

**STOP conditions:** Any unexpected non-404 local test route; remote webhook accepting requests while disabled; wrong D1 binding; publicly active payment links without approved terms; sender pointing to an uncontrolled recipient; unverified customer identity; unknown live-mode provider credentials; unresolved CI regressions. No checkout, refund or email may be executed in these states.

## Current decision

**GO** for read-only remote D1 inventory and disabled safety checks. **NO-GO** for remote ledger migration, provider activation, signed remote event injection, publishing/sending notifications or live payments without separate scoped approval.


## Remote D1 migration completed — founder-confirmed, November 15, 2026

The founder explicitly approved only the isolated notification ledger migration in `groundwork-payment-sandbox-isolated`. A comment-free migration with **two notification tables, one index and seven triggers** was prepared and tested in GitHub Actions. The founder executed it in the named Cloudflare D1 Console and supplied the resulting read-only inventory screenshots: **all 17 of 17 expected schema objects were `PRESENT`**, including the seven pre-existing payment objects and all ten new notification objects.

This verifies **object-name presence** in the right console; it does **not** yet establish byte-for-byte definitions, the physical runtime binding, trigger operation against remote data, or remote payment and email integrations. Do not re-run the migration. No main-app database, Stripe payment link, webhook, Resend template, or public checkout setting was changed as part of the approved work.

### Next read-only verification (no migration or test writes authorized)

1. In **the same isolated D1 Console**, execute only `preorder/payment-service/remote_d1_notification_readonly_definition_audit.sql`. It selects from `sqlite_master` and flags `KEY_CLAUSES_FOUND`, `REVIEW_DEFINITION` or `MISSING` for all ten notification objects. `KEY_CLAUSES_FOUND` is a **partial clause-presence check**, not full semantic proof of triggers or indexes.
2. In Cloudflare **Workers & Pages → groundwork-payment-sandbox-isolated → Settings → Bindings**, inspect (do not edit) the D1 binding. Expect **variable name `DB`**, type **D1 database**, target **`groundwork-payment-sandbox-isolated`**. A screenshot of the binding **without secrets** lets the founder compare it with the isolated database; the unchanged PR template alone cannot prove the remote Worker setting.
3. In Worker **Settings → Variables and Secrets**, only inspect the labels and nonsecret values: `PAYMENTS_MODE=disabled`, `TERMS_APPROVED=false`, `TERMS_VERSION=UNAPPROVED`. Never reveal the Stripe/Resend secret values.
4. Continue to keep Stripe test Payment Links inactive, its webhook disabled, and all Resend transaction templates unpublished. No writes to the remote D1 are required for these steps.

A live remote D1 trigger-behavior test would require a **separately approved** isolated synthetic insert and a safe rollback/cleanup approach; it is not authorized by the preceding read-only inventory or this continuation.
