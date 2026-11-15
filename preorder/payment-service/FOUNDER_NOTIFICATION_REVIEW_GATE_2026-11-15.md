# Independent founder notification review — draft implementation checkpoint

**Date:** November 15, 2026  
**Scope:** Draft PR #17 branch only. No Cloudflare deployment, Stripe activation, email sending, D1 migration, or public checkout authorization.

## Problem and control

Previously an outbox row with `review_completed_at` set and state `review_verified` could be treated as reviewed without persisted, cryptographically bound evidence identifying who reviewed it or which Stripe facts were checked. The draft improvement separates **founder identity authentication**, **independent Stripe test data re-verification**, **append-only review evidence**, and **notification dispatch**.

## Newly staged components

1. `notification_reviewer.draft.mjs`: independently fetches the exact paid test-mode Stripe Checkout session and its price/line items; compares against the immutable D1 purchase; verifies test-recipient ownership evidence via HMAC; verifies refunded amount/intent against a separately recorded `refund.created` journal and a fetched Stripe test refund, where relevant; explicitly rejects delivery_update until reviewed delivery copy is separately supported. All functions fail closed on mismatches or unavailable provider evidence.
2. `notification_review_evidence.draft.sql`: **unapplied schema** with new `prepurchase_notification_review_evidence` table and four guard triggers. Binds evidence to exact outbox identity, stores reviewer and provider-evidence HMAC fingerprints (no plaintext email), blocks evidence modification/deletion, and rejects `review_pending → review_verified` unless timestamp and notification identity match preexisting evidence. Data is deliberately append-only; future migrations require a separately approved approach and recovery plan.
3. `founder_notification_worker.draft.mjs` adds `POST /founder/notifications/review` guarded by the preexisting Cloudflare Access authenticated founder application audience and identity, separate `FOUNDER_NOTIFICATION_REVIEW_ENABLED=true` toggle, custom operator action header, explicit confirmation string, strict small JSON body, same-origin handling, and underlying identity checks. It never sends a notification during review. Its separate dispatch path additionally verifies a cryptographically signed, immutable review-evidence record before calling the draft sender.
4. `notification_reviewer.draft.test.mjs` and `notification_review_evidence.test.py` verify authentication/release gates, invalid states, session/recipient/amount mismatches, refund corroboration, missing/tampered cryptographic seal, immutable SQL proof, and audit transitions, entirely offline. Tests are added to `.github/workflows/prepurchase-notification-ci.yml`.

## Runtime prerequisites and explicit no-go conditions

- **Remote database still lacks the new review-evidence table/triggers.** Do not run `notification_review_evidence.draft.sql` without fresh **specific** founder approval and an isolated D1 read-only inventory. The previous founder approval applied only to the original ten notification-ledger objects and synthetic trigger testing, not this extension.
- Cloudflare Access must be independently configured for a **separate isolated** founder notification Worker with exact founder identity and app audience. It has NOT been deployed or configured. The existing payment receiver remains unchanged.
- Defaults stay off: `FOUNDER_NOTIFICATION_ADMIN_MODE` and `FOUNDER_NOTIFICATION_REVIEW_ENABLED` must not be enabled as a side effect of staging code, and `FOUNDER_NOTIFICATION_DISPATCH_ENABLED` must remain off pending separate approval.
- `PAYMENTS_MODE=disabled`, `TERMS_APPROVED=false`, `TERMS_VERSION=UNAPPROVED` remain the real deployed isolated payment-Worker safety settings. Sending additionally requires a **separate** and later-authorized release, published Resend templates, verified founder allowlist, and strong HMAC secret. No approved customer sale is inferred from a local test passing.
- The current founder-only review API is **only for a controlled, founder-owned Stripe TEST purchase**; not a customer-support approval system. It does not create pending notices, reassign recipients, publish templates, prepare/approve delivery copy, trigger payment, grant membership, or send email automatically.
- The evidence HMAC binds to a canonical source data snapshot, but the sender separately fetches Stripe verification again at dispatch; a signature alone does not replace that re-verification. Record race/exception behavior must be validated in Workerd before deploying.
- No live Stripe mode, direct customer email, local `/__test/*` endpoints, or untrusted request-supplied identity is permitted.

## Release progression

**PASS** only for draft/offline code when all CI jobs are green. **Next**: add a read-only isolated-D1 inventory for new review objects; verify D1 batch transactions and outbox trigger behavior in native Workerd with synthetic data; review Cloudflare Access policy and separate Worker routing; request explicit bounded authorization before any **remote** migration or deployment. Do not merge the draft PR or enable Stripe/Resend as part of this preparation.

## Native Workerd / D1 approval transaction checkpoint — November 15, 2026

**PASS (locally, not remote):** GitHub Actions run [43716616316](https://github.com/Groundworkable/free-bill-preview/actions/runs/43716616316) at commit `fd9c761` passed both `notification-safe-tests` and `remote-worker-fail-closed`. The test suite includes `notification_review.workerd.local.test.mjs` using `createTestHarness`, an isolated in-memory Cloudflare D1 database, and `notification_review.workerd.local.entry.mjs` (test-only entrypoint, **NEVER DEPLOY**).

Cases verified against native Workerd/D1:

- A direct `review_pending → review_verified` update without signed evidence is rejected by the new draft trigger.
- A valid isolated `db.batch([INSERT evidence, UPDATE outbox ... RETURNING])` succeeds; the proof, `review_verified` state, matching timestamp, and two-entry journal are present.
- Repeating the same approval returns not-approved without changing its proof or audit journal.
- An intentionally injected D1 trigger failure on the second batch statement rolls back the first evidence INSERT. The pending record and single initial journal entry remain unchanged.
- Identity-mismatched proof is rejected; no evidence or review transition is committed.
- Append-only evidence UPDATE and DELETE are rejected; no payment provider events are generated.
- The test-only entrypoint returns 404 for public payment, founder-dispatch, and unrelated routes.

**Boundary:** This tests local D1 SQL and the draft adapter's transaction contract with synthetic data; it does not prove real Cloudflare Access configuration, remote D1 deployment, independent real Stripe API responses, Resend delivery, or concurrent cross-isolate dispatch at scale. The reviewed `notification_review_evidence.draft.sql` remains **unmigrated** in the remote isolated database, and approval must be requested separately. The current isolated payment Worker, Stripe links/webhook, Resend templates and public website remain disabled and unchanged.
