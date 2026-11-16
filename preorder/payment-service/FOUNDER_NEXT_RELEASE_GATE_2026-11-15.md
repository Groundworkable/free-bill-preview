# Groundwork pre-purchase — CURRENT release gate (updated November 16, 2026)

**Source of truth for next agent:** Draft PR #17 on `site/prepurchase-checkout-gate-2026-11-13`. Earlier November 15 instructions stating the founder Worker was rolled back/inactive are **superseded** by the following completed deployment. DO NOT ask the founder to repeat the promotion, Access checks, D1 migrations or synthetic trigger rehearsals.

## Completed and evidenced — do not repeat

1. **Founder notification Worker deployed:** `groundwork-founder-notifications-isolated` exact tested version `22367a82-2713-4f1f-b927-65301fe75a17` was promoted to **100% production traffic**. Founder-authenticated Wrangler status reported deployment at `2026-11-16T08:05:24.464Z`. Previously deployed `1f97ea8e-4ba6-47d9-87f6-11594c938cc1` is the recorded rollback version.
2. **Access protection:** Cloudflare dashboard showed Worker Access **All traffic**, Groundwork Owner Only Allow policy. Founder supplied an Incognito Cloudflare Access challenge, plus authenticated `GET /founder/notifications/status` disabled `503 {"status":"service_disabled"}` evidence before runtime database/status settings were enabled.
3. **Existing remote D1:** `groundwork-payment-sandbox-isolated` had its previously approved notification/outbox/review evidence migrations installed and remote synthetic trigger/negative guards completed. **Never replay the migrations or test fixture inserts.**
4. **Founder Worker binding:** Founder saved production D1 binding **`DB`** to `groundwork-payment-sandbox-isolated` and separately saved `FOUNDER_NOTIFICATION_ADMIN_MODE=sandbox_access_only` while retaining founder Access identity variables. The Worker runtime is allowed to read a narrow status.
5. **First live authenticated D1 status lookup PASSED:** Existing synthetic `gwn1_` + 64 `9` characters returned exact JSON `{"status":"found","noticeType":"purchase_confirmation","state":"review_pending","reviewed":false}`. This was **read-only**; no review approval or sending occurred. Browser screenshot verifies body but not an independent HTTP status code for this read. See final November 16 PR comments for screenshot-based checkpoints.
6. **Payment receiver/source/DB guard checks:** Previously completed and recorded in PR comments. `groundwork-payment-sandbox-isolated` payment receiver is a separate Worker and was not changed by the founder notification deployment.

## Newly staged opt-in payment-to-review handoff (November 16, 2026)

Draft PR #17 now includes `notification_outbox_enqueue.draft.mjs`, `notification_outbox_enqueue.draft.test.mjs` and an import/conditional database-batch append in `worker.mjs`. This is **not the deployed payment Worker's source**. It changes no current Cloudflare service. The new feature does nothing unless a separately authorized environment variable `FOUNDER_NOTIFICATION_OUTBOX_MODE=sandbox_founder_only` is deliberately configured on the **isolated payment receiver**.

When that opt-in is present, the draft code requires all of: Stripe TEST credentials, sandbox payment mode, previously approved terms/version, a paid TEST Checkout session, Stripe-hosted accepted terms, exact allowlisted founder recipient, long HMAC secret, `NOTIFICATION_SEND_MODE=disabled`, dispatch not enabled, and operator release not enabled. The new record uses deterministic HMAC ID/recipient fingerprint and is inserted as **review_pending only** inside the existing purchase event/order D1 batch, so failure rolls the whole batch back. A duplicate event on a previously stored purchase does not enqueue a new notice. No plaintext email is stored, no delivery/review authorization is created, and no membership becomes active.

**Not yet verified:** new native CI outcome and end-to-end isolated D1/Workerd integration with the new opt-in enabled. Existing synthetic Workerd tests tested prior behavior; do not call this feature remotely tested. No production/test Cloudflare variable was added. Do not enable the new gate or activate test payment webhook/Stripe links before separately approved terms and real test-purchase readiness.

## Native Workerd/D1 integration coverage staged (November 16, 2026)

**Draft-only, not deployed:** Added `notification_enqueue.workerd.local.entry.mjs` and `notification_enqueue.workerd.local.test.mjs` for the newly gated payment-to-notification handoff. This is a **different new test** from the earlier completed database/migration, review-evidence and synthetic guard tests; do not ask the founder to repeat any of those. The new harness routes real `worker.mjs` webhook requests into an isolated in-memory Cloudflare D1 seeded from the existing purchase schema, the approved notification-ledger migration and review-evidence schema. It uses entirely synthetic Stripe webhook signing and mocked Stripe line-item retrieval, with no external Stripe payment, Resend sending or production routes.

Five native Workerd cases are staged: unsigned rejection with zero inserts; verified consent-accepted founder-only TEST purchase creating an atomic immutable order and exactly one `review_pending` notification/audit journal row; duplicate event/secondary event with no duplicate notice; non-allowlisted recipient rejected before any new event/order/notice; and injected outbox-trigger failure rolling back **all** event/order/outbox writes. No review approval, dispatch or membership activation occurs. The test-only `/__test/*` helper routes live solely in the special local harness entrypoint, **never deploy that entrypoint**. CI workflow now runs `node --test notification_enqueue.workerd.local.test.mjs` in the existing Workerd dependencies stage.

**Verification level:** GitHub readback confirms the two files and CI workflow step were committed at `dd7553950a1b98756dd9d6aacadda9d0c54ad9c5`. The GitHub connector reported zero associated workflow runs/statuses; the new native test has **NOT BEEN OBSERVED PASSING**. The present container does not have the Wrangler/MSW harness dependencies and has no GitHub network clone capability. Do not claim CI PASS until observed on GitHub Actions; fix any actual failure before any further release consideration. Existing live systems remain exactly as prior founder-screenshot verified; no remote migration, new binding, variable, Stripe/Resend activity or payment link activation.

## Current implementation — draft code only

Review/dispatch are **not** authorized or enabled. At PR head `a30c88eb8ee78d0ecf3de62bbf3874dda98ab2f0`, the founder's review verifier and Stripe TEST read adapter have been separated from the notification send-mode gate so independently verified review could eventually run with `NOTIFICATION_SEND_MODE=disabled`. New regression tests cover this separation, disabled sending, and closed review/admin/terms/payment gates.

The existing GitHub notification CI workflow has **push** and **pull_request** triggers for these changed files, and calls both `notification_reviewer.draft.test.mjs` and `notification_provider_adapters.sandbox.test.mjs`. A fresh workflow result for this new head has **not** been independently retrieved: the connected GitHub run-lookup returns no runs even for a previous head whose native CI was recorded as successful. **Do not claim the new CI passed or failed until observing the native GitHub Actions run.**

## Read-only Stripe TEST account evidence (November 16, 2026)

Using the connected **Able Systems LLC test-mode** Stripe account:
- `GET /v1/checkout/sessions`: **0 Checkout Sessions**, `has_more=false`.
- `GET /v1/payment_intents`: **0 Payment Intents**, `has_more=false`.
- Two one-time test Payment Links (monthly and annual) both **`active=false`** and **`consent_collection=null`**. Both have `automatic_tax.enabled=true`, which does **not** imply tax is collected absent registrations; earlier provider inventory found zero tax registrations.
- This is a test-mode snapshot only. Live-mode transactions were not inspected.
- There is **no genuine paid Stripe TEST Checkout Session to support independently signed review evidence yet**. The synthetic D1 `review_pending` fixture must **never** be approved as though it were a real provider-confirmed payment.

## Next real milestone: isolated, consent-aware Stripe TEST purchase evidence

1. **Confirm native CI of the changed PR head**; do not rerun previous D1/protection/deployment tests manually. Correct only demonstrated regressions.
2. **Before creating/enabling any test Checkout or changing test Payment Links**, resolve the test-mode hosted terms consent configuration and document tax/registration applicability and customer-facing terms readiness. Obtain explicit, narrowly scoped founder approval for any Stripe write.
3. After a separately authorized real **test-mode** Checkout Session exists, verify its exact line item, paid status, non-live PaymentIntent, consent, order identity, recipient HMAC and signed review requirements. A review action requires separate pre-approved credentials and release toggles; do not use an existing fake outbox record.
4. Keep **notification dispatch and Resend sending disabled** throughout the review milestone. Their release is a separate, later founder decision.

## Closed unless separately approved

No repeat SQL migrations, no more permanent synthetic fixtures, no paid/live collection, no public checkout activation, no Stripe webhook/Payment Link activation, no tax registration invented or added, no email/template publication, no Resend transport release, no automatic approvals, no PR merge or production application changes. Preserve Cloudflare Access All traffic and owner identity variables. Keep `FOUNDER_NOTIFICATION_DISPATCH_ENABLED` disabled and `NOTIFICATION_SEND_MODE` disabled.

**Latest progress:** Founder-only status runtime is deployed and performing read-only D1 lookups. The next remaining dependency is a *real provider-confirmed Stripe test purchase* with approved consent/evidence, **not** another Cloudflare deployment-status test.
