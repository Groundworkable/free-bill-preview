# Groundwork isolated sandbox payment receiver

**Status:** Code review and automated tests only. No Cloudflare Worker, D1 database, Stripe webhook endpoint, or live checkout is deployed by this PR.

## Safeguards

- This is intentionally separate from the `groundworkable-groundwork-life` production Worker and all existing Groundwork Supabase projects.
- A Cloudflare account operator must provision a dedicated test Worker and a new, isolated D1 database before any networked integration tests.
- The receiver processes verified **Stripe test-mode** Checkout events only.
- It checks the approved $9.99 and $96 one-time Stripe prices and exact additional tax amounts.
- The only purchase status written is `paid_unfulfilled`. This project has **no** app entitlement or activation integration.
- No keys in git, browser code, previews, source comments, or GitHub Actions secrets without explicit authorization.
- The current Stripe test links remain deactivated.
- Stripe Tax setup is still pending: tax head-office address missing, and no tax registrations have been added in Stripe.

## Configure an isolated test Worker — not a production instruction

This is a deliberately incomplete setup checklist, **not an executable deployment script**. It must be reviewed by the founder before creating cloud resources.

1. Create a **new test D1 database** dedicated to these payment tests; do not bind to an existing Groundwork database.
2. Apply `schema.sql` to that test database. Run `python3 schema.test.py` and `node --test worker.test.mjs` locally/in CI.
3. Bind the new database as `DB` in a **new sandbox-only Worker**. Deploy `worker.mjs` only after code review and ensure `PAYMENTS_MODE=sandbox`.
4. Configure these test-only values privately: `STRIPE_WEBHOOK_SECRET`, `STRIPE_TEST_SECRET_KEY`, `MONTH_LINK_ID`, `ANNUAL_LINK_ID`, `MONTH_PRICE_ID`, and `ANNUAL_PRICE_ID`. Use the IDs of the verified test-mode offers. Set secrets with the secure Cloudflare secrets interface, never in public git.
5. Register a **test-mode** Stripe webhook endpoint to the new Worker's `/webhooks/stripe` path for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. No production events and no application routing changes.
6. Only after tax settings are complete, briefly activate a **test link** to perform a real sandbox checkout; verify the Stripe session, signed webhook delivery and exactly one `paid_unfulfilled` database row. Verify that no membership activates.
7. Test canceled/failed/delayed payments, duplicate deliveries, and mismatched price/tax scenarios. Disable the test links afterward and keep customer-facing site gates disabled.

## Local integration test (completed in pull-request CI)

The test harness uses Cloudflare's local `workerd` and an isolated local D1 database. It injects **fake** Stripe credentials, intercepts outbound Stripe line-item requests using MSW, and exercises a signed synthetic payment, duplicate delivery, invalid signatures, invalid prices, and storage behavior. It requires no Cloudflare account and makes no real Stripe charges.

To reproduce from `preorder/payment-service/` with a compatible Node.js version:

```sh
npm install --no-save --no-package-lock --ignore-scripts wrangler@4 msw@2
node --test worker.test.mjs worker.local.test.mjs
python3 schema.test.py
python3 isolation.test.py
```

The local test-only entrypoint `worker.local.entry.mjs` exposes D1 inspection endpoints **only to the local test harness**. The deployment example points to `worker.mjs` instead; never deploy `worker.local.entry.mjs` or copy its inspection routes into a remotely accessible Worker.

A **real** Stripe-to-Cloudflare delivery test is still blocked on authorized creation of new isolated cloud resources, webhook secrets, and Stripe Tax setup.

## Current test-mode resource IDs (non-secret)

| Term | Stripe price ID | Stripe link ID |
|---|---|---|
| Monthly, one-time $9.99 | `price_1UbK2YJK9stEim4wCsZ0tyao` | `plink_1UbK33JK9stEim4w7BvY2CnM` |
| Annual, one-time $96 | `price_1UbK2aJK9stEim4wgnY5LRVR` | `plink_1UbK3MJK9stEim4w2nS3loNW` |

These IDs are **test-only**. Both Stripe links were observed inactive.

## Verification versus implementation

The automated tests mock Stripe network responses and exercise webhook logic with synthetic signed events. The SQLite schema tests verify unique payment identifiers, non-activation constraints and transaction rollback in an in-memory database.

**These tests are not proof of actual Stripe-to-Cloudflare connectivity.** The end-to-end sandbox test is blocked until a new isolated Worker and D1 database exist, a test-only webhook destination is configured, and Stripe Tax settings are completed. The founder has not authorized deployment or activation.

## Next release gates

A customer-facing pre-purchase still needs approved dates/access terms, refund/delay policy, a support channel, a legally valid tax configuration, an issued Retail License, and a reconciliation model for future application users. No real money or customer access until those are verified.
