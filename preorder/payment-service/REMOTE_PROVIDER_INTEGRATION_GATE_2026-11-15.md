# Isolated remote provider integration gate — November 15, 2026

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
