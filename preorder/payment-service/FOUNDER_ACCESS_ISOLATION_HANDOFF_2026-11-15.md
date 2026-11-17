# Founder-only Cloudflare Access Worker — scoped preparation, not deployment

**Scope:** Draft PR #17, November 15, 2026. This is an isolated access-control *plan and code safeguard*, not authorization to deploy or enable notifications.

## Evidence completed before this phase

- The founder-verified remote Cloudflare D1 synthetic review-evidence guard suite closed **6/6 PASS**, with the fake notification still pending, its evidence unchanged, the journal intact, and no payment events/financial changes.
- Reviewed current separate draft `founder_notification_worker.draft.mjs` has three routes: founder status, founder review, and founder dispatch, all behind `ctx.access`, expected audience and exact founder email; review and dispatch additionally have independent release gates.
- The **deployed** payment-only Worker `groundwork-payment-sandbox-isolated` remains unchanged and fail-closed. Do not replace it with the founder service.
- Current draft provider adapters remain gated for Stripe test mode and Resend only. No Resend template publication or Stripe test Payment Link/webhook activation approved.

## Newly staged no-deployment scaffold

`wrangler.founder-notification.draft.toml` names **`groundwork-founder-notifications-isolated`**, a **new separate Worker** with draft founder entrypoint, `workers_dev=false`, `preview_urls=false`, and **no routes/custom domain, D1 binding, audience, founder email, provider keys or HMAC secrets**. All notification operational flags and payment/legal gates are explicitly disabled. **Never deploy this scaffold as a functioning service without a separate, specific decision and review.**

`founder_access_deployment_gate.test.py` checks these defaults and prevents accidental reuse of the existing payment receiver or test-only entrypoint. CI runs this offline on the PR branch.

## Cloudflare Access configuration for a later separately authorized deployment

Per Cloudflare's documentation (verified November 15, 2026):
https://developers.cloudflare.com/workers/configuration/cloudflare-access/

1. **Protect ONE Worker, not all Workers.** The proposed object is the new `groundwork-founder-notifications-isolated` Worker, NOT `groundwork-payment-sandbox-isolated`, Groundwork's public site, or any existing application. Cloudflare dashboard: Workers & Pages → select the **new** Worker → **Access** → Protect this Worker behind Access.
2. Select **All traffic** (production and previews), not Previews only. Configure a **single exact-identity Allow policy** for the founder's verified login address — **not an entire domain**, anyone with email, or permissive bypass/service tokens. Require an actual sign-in. The owner must verify this policy in the Cloudflare dashboard before the Worker receives an enabled route.
3. Inspect the Access application **Audience (AUD)** identifier and the exact verified sign-in email from the policy. Configure `FOUNDER_ACCESS_AUD` and `FOUNDER_ACCESS_EMAIL` as separate Worker environment variables ONLY after confirming the Access application exists. Never guess an AUD or trust request headers claiming identity.
4. `ctx.access` exists only for requests directly authenticated by Cloudflare Access. `ctx.access.getIdentity()` identifies the signed-in user; the Worker compares this with the configured founder address, and compares the `aud` with the application's configured audience. Workers invoked through a service binding do not inherit Access context.
5. First deployable state should remain **administratively disabled**: `FOUNDER_NOTIFICATION_ADMIN_MODE=disabled`; `FOUNDER_NOTIFICATION_REVIEW_ENABLED=false`; `FOUNDER_NOTIFICATION_DISPATCH_ENABLED=false`; `NOTIFICATION_SEND_MODE=disabled`; `NOTIFICATION_OPERATOR_RELEASE=false`; `NOTIFICATION_TEMPLATES_APPROVED=false`; `PAYMENTS_MODE=disabled`; `TERMS_APPROVED=false`; `TERMS_VERSION=UNAPPROVED`. No Stripe/Resend credentials or permission to send until separately gated.
6. Remote D1 binding for **only** `groundwork-payment-sandbox-isolated` and any routes/preview/domain exposure require separate exact-scope review. No standing public endpoint should exist during the preparation stage.
7. After a specifically approved rollout, test authenticated identity, unauthenticated denial, wrong identity denial, forged-header denial, GET status no-store, review/dispatch disabled, logging redaction, and immediate access revocation. Preserve deterministic rollback: disable all flags, disable route, retain immutable ledger, never auto-retry an ambiguous send.

## Blocking conditions / not authorized

- This stage creates **no** Cloudflare Access app, Worker deployment, hostname or database binding. Exact founder policy and Access AUD are unknown until configured.
- Do NOT run `wrangler deploy`, create a production route, protect all Workers, enable Access bypass, publish Resend templates, enable Stripe Payment Links/webhooks, turn on payment/legal gates, or send a customer email.
- `worker.local.entry.mjs` and `notification_review.workerd.local.entry.mjs` contain test-only routes and **must never be deployed**.
- Do not present green offline tests as proof of a configured real Cloudflare Access policy or delivery integration.
- Future founder approval must state what Worker is created, what Access policy is applied, how it stays unreachable/disabled during setup, how source/bindings and routing are reviewed, and rollback steps.

**Decision at this checkpoint:** GO for source/config/CI/documentation; NO-GO for Cloudflare deployment or Access policy activation absent specific approval.
