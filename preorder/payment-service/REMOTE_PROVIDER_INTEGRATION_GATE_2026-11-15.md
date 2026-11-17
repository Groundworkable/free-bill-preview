# Isolated remote provider integration gate — November 15, 2026

> **November 17, 2026 verified continuation — this supersedes stale provider/legal status statements below.** Founder has already approved and published the 13-section Privacy V2 and seven-section Pre-Purchase Terms, effective November 17, 2026. Stripe's public Terms URL is configured, and both original TEST links now require accepted Terms but remain INACTIVE. A disposable **separate** Stripe TEST Payment Link successfully recorded a one-time $9.99 + $0.90 tax payment, `consent.terms_of_service=accepted`, and complete $10.89 TEST refund; it was then auto-deactivated. Its id is **not allowlisted** by the worker. Local native Workerd/D1 replay of real-provider-shaped synthetic signed events, including refund before purchase, passed CI `44180284704`. A direct Stripe API read reconfirmed the registered isolated TEST webhook `we_1UbShUJK9stEim4wVJZvDGVz` is **disabled** with expected checkout/refund event types; both original payment links are **inactive**. The remote fail-closed gate has passed. **No real Stripe-signed webhook has yet reached remote isolated D1.** The older November 15 document remains as historical implementation evidence, not a list of setup tasks to repeat.
>
> **Previously verified; do NOT redo merely for handoff:** founder confirmed 17/17 required remote D1 objects, 10/10 important definition clauses, and Cloudflare `DB` bound to isolated `groundwork-payment-sandbox-isolated` (November 15 screenshots). This is historical configuration evidence; it does not authenticate *today's* deployed variables, secrets or source parity.
>
> **Only unresolved external preflight:** Read the **existing payment Worker** `groundwork-payment-sandbox-isolated` deployed version and current Settings → Variables and Secrets names/types, without exposing values. Confirm `PAYMENTS_MODE` is disabled, `TERMS_APPROVED` is not yet set for processing, original TEST `MONTH_LINK_ID`/`ANNUAL_LINK_ID`, `MONTH_PRICE_ID`/`ANNUAL_PRICE_ID`, `TERMS_VERSION` (internal `prepurchase-vYYYY-MM-DD` format corresponding to the published 2026-11-17 terms), service-role-only isolated `DB`, and presence **by NAME ONLY** of `STRIPE_WEBHOOK_SECRET` and `STRIPE_TEST_SECRET_KEY`. Deployed source must be independently compared to reviewed `worker.mjs`. Do not reveal Stripe API keys or webhook signing secret, and do not assume disabled HTTP 503 proves parity. Note: the internal `prepurchase-v2026-11-17` receipt identifier and the public page's `prepurchase-terms-v1` are **distinct strings**; the mapping must be confirmed for a real webhook record before any customer activation.
>
> **STOP until proven:** No Cloudflare authenticated access is currently connected in this chat. Do not deploy a new Worker, change bindings, enable the TEST webhook or original links, apply database migrations, send emails or activate paid accounts based only on past screenshots and “onward.” Once the current remote version and bindings are verified, request separately scoped TEST-only activation approval and a guaranteed shutdown/rollback. LIVE payments remain off.


**Scope:** planning and read-only provider verification following founder-approved remote D1 synthetic protection testing. No live system changes authorized in this phase.

## Confirmed checkpoints

- Draft PR #17 contains a signed **synthetic** Stripe webhook → local Workerd/D1 → **mocked** Resend end-to-end test, passed in GitHub Actions.
- Founder verified remote D1 migration (17/17 required objects), 10/10 important definition clauses and the isolated Worker's **DB** binding pointing to **groundwork-payment-sandbox-isolated**.
- Founder completed authorized remote synthetic-data-only D1 protections: rejected unauthorized direct delivery transition, rejected notification identity mutation, rejected DELETE, allowed review_pending→manual_review and independently verified both journal entries. This test left one clearly fake append-only order and notification in manual_review, without a Stripe event.
- The isolated deployed Worker still returns 503 for unsigned requests while disabled and returns 404 for local-only test routes, as observed in read-only remote smoke CI. This does not independently establish deployed source-code parity.

## Fresh connected-provider state (read only)

- Stripe account: **test mode** only. Monthly and annual one-time Payment Links remain **inactive**; hosted terms consent_collection remains **null**; webhook for checkout/refund/dispute events remains **disabled**.
- Resend domain is verified. All **three** branded transactional templates are still **draft/unpublished**, with matching required variables: confirmation (ORDER_REFERENCE, OFFER_NAME, SUBTOTAL, TAX, TOTAL_PAID, ACCESS_SCHEDULE); delivery (ORDER_REFERENCE, UPDATE_DATE, DELIVERY_STATUS, NEXT_STEP); refund (ORDER_REFERENCE, REFUND_REFERENCE, REFUND_AMOUNT, INITIATED_DATE).
- Public preorder/checkout-config.json remains enabled=false, termsApproved=false, no public links.

## Critical implementation distinction

- `worker.mjs` is the **deployable payment webhook receiver**; it has no imported notification sender, admin notification route, or built-in Resend call. Its existing fail-closed gate requires PAYMENTS_MODE=sandbox, TERMS_APPROVED=true, matching approved terms version, valid Stripe test secrets and isolated DB binding before processing any event.
- `notification_sender.sandbox.mjs` and `notification_provider_adapters.sandbox.mjs` are **draft dependency-injected modules only**, not a deployed notification service. They require a separately authenticated founder-only entry point, recipient allowlist, HMAC evidence, approved template, operator release, immutable outbox claim, and manual reconciliation after an ambiguous send.
- `worker.local.entry.mjs` has test-only /__test/* routes and synthetic mock transport. **Never deploy this local test entrypoint.**

## Next safe actions, in order

1. **Source parity:** founder opens the *isolated* Worker dashboard → Edit code → inspect deployed source filename/build and compare with `preorder/payment-service/worker.mjs` in PR #17. Do not paste secrets or change/deploy code merely for inspection. Source hash isn't independently known today. Do not assume deployed notification modules are available.
2. **Gate inspection:** founder inspects (not modifies) settings for PAYMENTS_MODE=disabled, TERMS_APPROVED=false, TERMS_VERSION=UNAPPROVED, the D1 binding DB and that secrets exist by **name only**; do not expose secret values.
3. **Design authenticated founder-only runtime** as separately reviewed, isolated handler/service for notification review/dispatch. Do not expose a general-purpose public test route, and never rely on test-only flags as sufficient operator authentication. Develop and CI-test without deployed sender or template publication.
4. **Integration contract tests:** verify Stripe test-only API reads, remote outbox HMAC identity, template variables/alias compatibility, provider idempotency, loss/timeout and post-acceptance reconciliation. The current mocked sender's CI pass does not establish actual Resend or Stripe API interoperability.
5. **Separate scoped founder approval** for any temporary test-mode endpoint/webhook enabling, template publishing, test payment/refund, remote Worker deployment, and exact shutdown/rollback sequence. Keep public website checkout disabled throughout.
6. Do not proceed to customer-facing sale until reviewed terms/privacy publication, Stripe hosted consent, tax/registration determinations and customer support refund/delay operations are resolved.

### Current decision

**GO:** read-only deployed-source comparison, draft-only provider contract tests and documentation.

**NO-GO:** deployments, remote D1 writes, live email/provider events, Resend template publication, Stripe Payment Link/webhook activation or public checkout without subsequent explicit scoped approval.
