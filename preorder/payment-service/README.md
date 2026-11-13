# Groundwork isolated sandbox payment receiver

**Status (November 13, 2026):** The founder created a separate Cloudflare Worker named `groundwork-payment-sandbox-isolated`, bound a new isolated D1 database as `DB`, ran the schema SQL in the D1 Console (Cloudflare reported success), and uploaded the reviewed `worker.mjs` to that isolated Worker. The root request displayed the expected `Not found`. These observations come from founder-provided screenshots; **remote webhook delivery and the live deployed code/version have not been independently verified**. This PR remains **draft**, public checkout is **disabled**, and the Stripe test links are **inactive**.

## Safeguards

- This is intentionally separate from the `groundworkable-groundwork-life` production Worker and all existing Groundwork Supabase projects.
- The founder has separately provisioned an isolated test Worker and D1 database. No deployment from this PR is wired to Cloudflare, and no existing Groundwork app worker/database was modified in this workstream.
- The receiver processes verified **Stripe test-mode** Checkout events only.
- It checks the approved $9.99 and $96 one-time Stripe prices and exact additional tax amounts.
- The only purchase status written is `paid_unfulfilled`. This project has **no** app entitlement or activation integration.
- No keys in git, browser code, previews, source comments, or GitHub Actions secrets without explicit authorization.
- The current Stripe test links remain deactivated.
- Stripe Tax setup is still pending: tax head-office address missing, and no tax registrations have been added in Stripe.

## Configure an isolated test Worker — not a production instruction

This is a deliberately incomplete setup checklist, **not an executable deployment script**. It must be reviewed by the founder before creating cloud resources.

1. **Reported complete:** A **new test D1 database** was created and bound to the dedicated Worker; do not change its binding to an existing Groundwork database.
2. **Reported complete:** Cloudflare D1 Console returned successful SQL execution of `schema.sql`. The schema and webhook tests also run in pull-request CI. The screenshot alone does not prove table contents; verify with `/tables` or read-only queries if needed.
3. **Reported complete:** Bound the new database as `DB`; the founder uploaded `worker.mjs` to the isolated Worker and its root displayed the expected `Not found` response. Payment mode remains disabled/unconfigured; do not enable until secrets, consent, and approved terms are available.
4. Configure these test-only values privately: `STRIPE_WEBHOOK_SECRET`, `STRIPE_TEST_SECRET_KEY`, `MONTH_LINK_ID`, `ANNUAL_LINK_ID`, `MONTH_PRICE_ID`, and `ANNUAL_PRICE_ID`. Use the IDs of the verified test-mode offers. Set secrets with the secure Cloudflare secrets interface, never in public git. The Worker will also require a separately approved `TERMS_VERSION` and `TERMS_APPROVED=true` in its isolated sandbox environment once the merchant terms exist.
5. Register a **test-mode** Stripe webhook endpoint to the new Worker's `/webhooks/stripe` path for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. No production events and no application routing changes.
6. Only after tax settings are complete, briefly activate a **test link** to perform a real sandbox checkout; verify the Stripe session, signed webhook delivery and exactly one `paid_unfulfilled` database row. Verify that no membership activates.
7. Test canceled/failed/delayed payments, duplicate deliveries, and mismatched price/tax scenarios. Disable the test links afterward and keep customer-facing site gates disabled.

## Stripe-hosted terms acceptance — added safety gate

The test receiver now checks `session.consent.terms_of_service === "accepted"` **and** requires `TERMS_APPROVED=true` and an immutable `TERMS_VERSION` (format `prepurchase-vYYYY-MM-DD`). The database retains that exact approved terms version with every paid-unfulfilled order. Without those values, the receiver returns 503 and cannot record a purchase.

Before activating **any** Payment Link, set a real, founder-approved terms URL in Stripe Public Details and require Stripe Checkout terms acceptance (`consent_collection.terms_of_service=required`). The current existing test links have `consent_collection:null` and remain inactive; they do **not** meet the new consent gate. The website's checkbox alone does not replace Stripe-hosted consent.

Do not invent the terms version, claim legal approval, or insert a fabricated terms URL to bypass this gate. The version should identify the actually published purchase/refund terms and be finalized before real customer charges.

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

A **real** Stripe-to-Cloudflare delivery test is still blocked on configuring a real test-mode Stripe webhook destination and its signing secret, securely storing test-only Stripe API credentials in the isolated Worker, approving and publishing customer terms, and completing Stripe Tax settings. The cloud resources exist, but remote end-to-end delivery remains unverified.

## Current test-mode resource IDs (non-secret)

| Term | Stripe price ID | Stripe link ID |
|---|---|---|
| Monthly, one-time $9.99 | `price_1UbK2YJK9stEim4wCsZ0tyao` | `plink_1UbK33JK9stEim4w7BvY2CnM` |
| Annual, one-time $96 | `price_1UbK2aJK9stEim4wgnY5LRVR` | `plink_1UbK3MJK9stEim4w2nS3loNW` |

These IDs are **test-only**. Both Stripe links were observed inactive.

## Verification versus implementation

The automated tests mock Stripe network responses and exercise webhook logic with synthetic signed events. The SQLite schema tests verify unique payment identifiers, non-activation constraints and transaction rollback in an in-memory database.

**These tests are not proof of actual Stripe-to-Cloudflare connectivity.** The founder created an isolated Worker and D1 database, but no confirmed Stripe webhook destination, signing secret, or complete cloud transaction exists. The founder authorized only the isolated Worker upload; no authorization to activate payment links, merge the website PR, change existing app infrastructure, or accept live payments was given.

## Next release gates

A customer-facing pre-purchase still needs approved dates/access terms, refund/delay policy, a support channel, a legally valid tax configuration, an issued Retail License, and a reconciliation model for future application users. No real money or customer access until those are verified.
