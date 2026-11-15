# Founder-only notification runtime — code and test checkpoint

**November 15, 2026 — draft PR #17. NOT deployed, not authorized for live operation.**

## What was built

- `founder_notification_worker.draft.mjs`: a **separate isolated Worker draft**, not part of deployed payment Worker `worker.mjs`. Routes:
  - `GET /founder/notifications/status?key=gwn1_...` — returns only notification type, state and a reviewed boolean. Requires authenticated founder via Cloudflare Access.
  - `POST /founder/notifications/dispatch` — must be deliberately enabled, authenticated, manually confirmed and find an *already* `review_verified` outbox record with a nonempty `review_completed_at`. The service **does not review, approve, insert or create** a notification.
- Access uses the Cloudflare Workers direct-request `ctx.access` object with `ctx.access.aud` and `ctx.access.getIdentity().email`. The configured Access application audience and normalized founder email must match. No trust is placed in request-supplied identity headers. Cloudflare reference: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Additional independent gates: `FOUNDER_NOTIFICATION_ADMIN_MODE=sandbox_access_only` is required even for status; dispatch additionally requires `FOUNDER_NOTIFICATION_DISPATCH_ENABLED=true`, `NOTIFICATION_SEND_MODE=sandbox_founder_test`, `NOTIFICATION_OPERATOR_RELEASE=true`, `NOTIFICATION_TEMPLATES_APPROVED=true`, `PAYMENTS_MODE=sandbox`, `TERMS_APPROVED=true`, approved terms version, plus all downstream Stripe test-only, Resend and recipient-HMAC checks in the draft adapters/sender.
- Only explicit JSON POST with exact notification key and confirmation phrase and custom operator-action header can reach dispatch. Requests with a mismatching browser Origin, oversized body, unknown fields, wrong method or malformed key are rejected.
- Explicit **no-go** for `delivery_update` until a separately verified delivery-copy approval adapter exists.
- Sender re-verifies approved order, paid Stripe test session, test price/line item/terms/tax, recipient allowlist and HMAC, draft-to-published template transition, refund payment evidence if relevant, then atomically claims the notification once before transport. Provider errors leave the ambiguous send for manual reconciliation and never auto-retry.

## CI

`founder_notification_worker.draft.test.mjs` uses only synthetic users and injected fake sender/store/adapters. It tests no Access/forged headers, wrong audience/email, missing release gates, blocked states, unapproved copy, incorrect origin/JSON/body, narrow status response, deliberate dispatch and sanitized errors.

GitHub Actions **run #43715374321** at **commit `80a3c29`** passed **both** `notification-safe-tests` and `remote-worker-fail-closed`. The latter confirms the currently deployed payment Worker still declines unsigned webhooks and does not expose test routes.

## What has NOT been built/approved

- No deployment of this draft Worker, no Cloudflare Access application created, no domain/routing assigned and no runtime secret or variable configured.
- No authenticated **independent review-approval** operation or trusted approval evidence verifier. The sender requires a pre-existing reviewed state; this Worker cannot create it. A mere operator flag must never be mistaken for review authorization.
- No signed delivery-copy review path; delivery updates stay blocked.
- No provider credential release, remote Stripe/test payment or webhook enablement, no Resend template publication or actual email.
- No public checkout, no changes to currently deployed isolated payment Worker, no PR merge.

## Separate deployment go/no-go checklist

Before requesting any deployment approval: review app-level Cloudflare Access policy with an exact, independently verified founder email and app audience; review separate isolated hostname/Worker to avoid modifying the working payment receiver; adopt robust event/review approval and audit procedure; verify legal/terms and tax gates; confirm all release flags start disabled; prepare precise one-time test destination and rollback; rerun fail-closed CI and remote DB read-only checks. If any prerequisite is unknown: **NO-GO** for deployment or sending.
