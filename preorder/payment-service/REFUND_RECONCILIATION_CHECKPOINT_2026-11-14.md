# Refund execution/reconciliation continuation — November 14, 2026

**Scope:** Draft PR #17 only. No live payment links, webhook activation, deployments, D1 migrations, membership changes, or refund issuance.

## Read-only Stripe test-account inspection

- Accessible account: Able Systems LLC, **test mode**.
- Stripe test PaymentIntents: **none returned**.
- Stripe test refunds: **none returned**.
- Previously registered isolated sandbox webhook destination: **disabled**, subscribed to checkout session completion events only.
- Therefore **no actual sandbox payment or refund execution can be verified**. A remote Stripe-to-D1 event and matching order have not been confirmed.

## Implemented in this checkpoint

- Added `refund_reconciliation.py`: a pure, read-only offline function comparing a **provided** Stripe provider snapshot, original isolated purchase, and isolated D1 event journal.
- Deduplicates refunds by provider refund ID, **not** by event count. Never chooses a current refund status based on event arrival order.
- Distinguishes succeeded, in-flight, failed/canceled refunds; reports unmatched charge-only events, missing provider/journal entries, amount/intent mismatches, over-refund risk, and disputes requiring review.
- Requires test-mode provider objects and a `paid_unfulfilled` order; rejects ambiguous/duplicate IDs. Does not modify purchases or entitlements.
- Added ten synthetic tests and included them in existing payment CI. They passed locally before commit; remote CI must be confirmed separately.
- **A simulation is not evidence of a real successful refund**. The reconciliation output keeps `real_refund_execution_verified=false` even when a synthetic snapshot indicates success. Neither this module nor its test may be used as an authorization to disburse funds.

## What remains blocked

1. Real Stripe **test-mode** checkout and signed webhook delivery, using previously approved purchase terms/Stripe Tax consent and an isolated deployed Worker/schema; no activation is currently authorized.
2. Authorized provider refund initiation and verification of pending, succeeded, and failed states. No test PaymentIntent currently exists to refund.
3. Provider-to-isolated-D1 journal comparison against a complete, verified snapshot; charge-to-PaymentIntent resolution must be designed and implemented.
4. Refund/dispute event subscription, deployment of reviewed handler, database-level append-only guarantees, and reconciliation/support operations — each gated by separate review and permission.
5. Final customer-facing terms, monitored support, tax/legal readiness, and verified retail license issuance before accepting real funds.

**Approved policy remains untouched:** preactivation full refund, seven paid-day full refund, entirely unused annual purchased months at $8 before tax adjustment, January 8 follow-up and January 15 resolution cutoff. One-time prepay does not authorize renewal.

**Release boundary:** Public checkout disabled; Draft PR #17 unmerged; no live Groundwork app, Supabase, or renovation changes.

## Continuation: Stripe readiness and draft immutability checks

- Read-only Stripe sandbox lookup on November 14 confirmed **zero Checkout Sessions**, PaymentIntents, and refunds in the available lists, and the existing test webhook is disabled.
- Both previously configured test Payment Links remain inactive with `consent_collection=null` (not approved for customer-facing use).
- Stripe Tax settings remain `status=pending`, with `head_office` missing; the sandbox registration list is empty. Do not claim automatic tax collection is ready.
- Added draft SQLite triggers that reject UPDATE and DELETE against the payment-change journal, and a schema test that asserts mutations fail and the original rows remain intact.
- Adjusted the **local-only** Workerd/D1 test seeding to execute complete SQL, preserving semicolons inside triggers. This change is not a remote D1 migration or Worker deployment.
- The ordinary application SQL path is protected against accidental journal mutation; privileged schema administrators could still drop triggers. This is not a tamper-proof ledger.
- CI was green at the preceding checkpoint. The new trigger changes require their own fresh CI verification.

**Next decision gate:** resolve Stripe Tax head office, genuine tax registrations as applicable, published customer terms and hosted terms acceptance, monitored support, and review of the isolated Worker before any time-limited real sandbox checkout/refund test. No activation has been performed.


## Latest verified configuration (November 14, 2026)

These items supersede earlier in-document observations about the **sandbox** head-office gate:

- The connected Able Systems LLC test account returned Stripe Tax `status=active` after the founder-provided legal head-office address was saved through the Stripe Tax Settings API. It was read again and remained `active`. This does **not** prove a tax registration or authorization to collect tax.
- Founder provided a screenshot of the shared `hello@groundworkbyable.com` mailbox aliases and confirmed `billing@groundworkbyable.com` was successfully tested. Billing contact is proposed for purchase/refund requests; a formal customer-support SLA and notification delivery are not independently verified.
- A proposed consolidated copy is at `preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md`. It is **not approved, effective, published, or configured as Stripe terms**.
- Stripe test Payment Links still require Stripe-hosted terms acceptance and a valid approved public Terms of Service URL, plus a separately authorized time-limited test. This document is not permission to enable them.


## Read-only charge correlation improvement — November 14, 2026

- `refund_reconciliation.py` now optionally accepts independently supplied **test-mode Stripe charge snapshots**. This permits reconciling charge-only refund/dispute notifications by resolving the charge to its PaymentIntent without changing D1 or app state.
- The function refuses duplicate, malformed, live-mode, non-USD or incomplete charge snapshots; detects contradictions between explicitly supplied PaymentIntents and charge-derived PaymentIntents; and keeps disputes subject to manual review.
- Additional **synthetic** tests cover a successfully correlated charge-only dispute, conflicting identifiers, and malformed/duplicate snapshots. This is not proof of a real charge or refund and cannot replace fetching verified provider state.
- Real charge retrieval, signed remote delivery, mapping verified customer contact to the order, and end-to-end refund execution remain outstanding. Do not enable the remote webhook or payment links from this change alone.

## Stripe account and PR verification

- Connected sandbox products and prices verified via Stripe API: one monthly `999`-cent one-time price and one annual `9600`-cent one-time price, with `tax_behavior=exclusive`, no recurring schedule, and one nonadjustable item per currently **inactive** Payment Link.
- Both links still require a valid published Terms of Service URL and `consent_collection.terms_of_service=required`; they currently have no terms collection.
- Stripe Tax settings `active` with the saved head-office address; this does **not** demonstrate that a tax registration exists or tax must be collected in every region.
- The existing isolated **test** webhook has refund/dispute and checkout events subscribed but remains disabled. No sandbox Checkout Sessions were returned in the available list.
- PR #17 public-site QA and offline preview **both passed** at the previous commit `64c68df`. The new charge-correlation changes require fresh CI verification.


## Founder-run remote isolated D1 migration — confirmed by console output (November 14, 2026)

The founder executed `remote_d1_additive_migration_2026-11-14.sql` in the Cloudflare D1 Console for the isolated payment database and supplied the subsequent `sqlite_master` result. **All seven expected object names were PRESENT:**

- Tables: `stripe_processed_events`, `prepurchase_orders`, `prepurchase_payment_changes`
- Journal triggers: `prepurchase_changes_block_update`, `prepurchase_changes_block_delete`
- Purchase triggers: `prepurchase_orders_block_update`, `prepurchase_orders_block_delete`

The pre-migration screenshot had shown the first two tables present and the other five objects missing. The follow-up screenshot returned all seven entries. This constitutes **founder-supplied evidence of remote schema-object presence**, not independently authenticated database access or proof that the trigger definitions are correct, the deployed Worker contains the draft journal handler, or that a real webhook/refund was processed. The migration should **not be rerun by default**; it is complete at the object-presence checkpoint. The Cloudflare Worker is still expected to be disabled. No production database was touched as part of the documented isolated migration.

**Next release gate:** inspect isolated deployed Worker version against the reviewed `worker.mjs` (including `refund.*` and `charge.dispute.*` handling), verify actual D1 binding, and complete hosted customer terms acceptance and a separately authorized isolated test transaction. Never enable payment links or webhook based on schema-object presence alone.


## Founder-supplied Cloudflare Worker source audit — November 14, 2026

After the founder's remote D1 Console confirmed all seven schema objects, the founder shared text copied from the isolated payment Worker's Cloudflare editor. This supplied source is an **older checkout-only receiver**:

- It recognizes only `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- It lacks the draft `recordPaymentChange` function and the `refund.*` / `charge.dispute.*` event handlers that appear in the current `preorder/payment-service/worker.mjs` in this PR.
- It acknowledges unknown event types with HTTP 200 without journaling; **do not enable the subscribed refund/dispute webhook while this receiver is deployed**, since records could be silently missed.

**Next controlled step (requires founder action in Cloudflare; not performed here):** Replace **only** the code in `groundwork-payment-sandbox-isolated` with the exact raw `preorder/payment-service/worker.mjs` from this branch, review the diff, and deploy only after verifying `PAYMENTS_MODE=disabled`, `TERMS_APPROVED=false`, and `TERMS_VERSION=UNAPPROVED` remain in the isolated Worker's configuration. Never copy `worker.local.entry.mjs` or local-only test routes into the deployed Worker. Secrets remain in Cloudflare bindings; do not paste them into source or GitHub. Re-run the safe remote fail-closed smoke test after any sandbox-only deployment. No Stripe Payment Links or webhook endpoint may be enabled as part of that code update.

Evidence classification: remote schema presence is founder-confirmed by screenshot; deployed-source version is founder-supplied pasted text; production app is untouched. Current draft `worker.mjs` is CI-tested but has **not** been confirmed deployed.

## Founder-reported isolated Worker redeployment — November 14, 2026

After reviewing the current `preorder/payment-service/worker.mjs` and identifying that the founder's earlier Cloudflare editor copy lacked refund/dispute handling, the founder confirmed **"done"** following instructions to replace the code and deploy the dedicated `groundwork-payment-sandbox-isolated` Worker. Earlier screenshot verified seven separate, correct text bindings (`PAYMENTS_MODE=disabled`, `TERMS_APPROVED=false`, `TERMS_VERSION=UNAPPROVED`, two link IDs and two price IDs), plus two Stripe secrets shown as encrypted. The founder's D1 Console verified all seven table/trigger names.

**Evidence distinction:** Code replacement and deployment are **founder-reported**, not yet independently verified to match the GitHub Worker bytes. The post-deployment remote unsigned-request smoke check must still be run and reviewed: expect HTTP 503 and `Payment receiver not configured`. That check proves the fail-closed deployed configuration at test time, **not** the exact code version or webhook-to-D1 delivery. Keep Stripe's isolated webhook disabled and both Payment Links inactive. Do not enable payments or grant membership.

## Post-deployment independent fail-closed verification — November 15, 2026 UTC

Following the founder-reported Cloudflare-only replacement of the isolated Worker source, we reran the GitHub Actions `cloudflare-fail-closed` job against the actual remote endpoint. Job `132696539764` on workflow run `43642319167` completed with **success**; its log explicitly states: `PASS: isolated deployed Worker is reachable and rejects payment requests while disabled` at `2026-11-15T04:17:40Z`.

A fresh Stripe **test-mode** API read also confirmed the webhook endpoint `we_1UbShUJK9stEim4wVJZvDGVz` remained `disabled` and both existing test-mode Payment Links `plink_1UbK3MJK9stEim4w2nS3loNW` and `plink_1UbK33JK9stEim4w7BvY2CnM` remained `active=false`.

**Verification boundary:** Remote fail-closed behavior is independently tested; source hash, full deployed code version, actual signed event delivery and remote D1 journal inserts remain unverified. Founder-supplied Cloudflare screenshots showed the required individual variables, secrets and seven remote SQL object names. No checkout, live payment, webhook activation, application entitlement, or production deployment was performed.


## Founder-verified business and billing alias delivery — November 14, 2026

The founder supplied inbox screenshots showing receipt of two separate test messages from an external Gmail address, addressed respectively to `billing@groundworkbyable.com` and `business@groundworkbyable.com`. Both **inbound** deliveries were successfully observed. `business@` is designated for organizational/pilot/partnership inquiries; `billing@` remains the billing/refund contact. The affiliate-specific alias/program is not needed for this release and is not approved implementation scope.

This verifies **inbound alias routing only**. It does not establish outbound send-as, case tracking, a formal response SLA, automated purchase/refund notifications or Stripe customer-email correlation. No paid mailbox or new subscription is required by this checkpoint. Live checkout remains disabled.
