# Groundwork payment verification & fulfillment gate — founder review

Status: **DESIGN ONLY — not implemented, not deployed, not authorized to grant membership.**

This document extends Draft PR #17 for the public marketing website, without changing the Groundwork application, Supabase, Cloudflare Worker, or existing renovation workstreams.

## Confirmed test-mode configuration (November 13, 2026)
- Individual **one-time** pre-purchase offers: $9.99 (one month) and $96 (twelve months).
- Stripe prices use `tax_behavior=exclusive`; products use `tax_code=txcd_10103000` (SaaS, personal use).
- Two Stripe test Payment Links created with `automatic_tax.enabled=true` and `billing_address_collection=required`, then **deactivated**. Sandbox products/prices are not live customer offers.
- No Stripe Tax jurisdiction registrations currently configured; sandbox tax settings report missing `head_office`. A link having automatic tax enabled does **not** mean correct tax is being collected.
- The live site checkout config remains disabled. Production account, customer billing and access entitlements were not modified.

## Event-to-order contract (pending implementation)
Do not implement this from browser redirects or URL query strings. The only payment-success source is verified Stripe server-side evidence.

1. A request to pre-purchase must display offer, base amount, applicable additional taxes, future-access status, expected timing, and published pre-purchase/refund/cancellation terms **before** payment.
2. Create or identify an internal order with a server-generated unique ID, offer version, quoted amount/currency, terms version and timestamp, and a state such as `pending_payment`.
3. Stripe Checkout associates the order ID with the payment; on verified `checkout.session.completed` and **paid** status (or other relevant asynchronous payment confirmation), validate known price ID, amount/currency, account environment, and customer linkage. Do not trust arbitrary client-submitted prices or customer identifiers.
4. Webhook endpoint must verify Stripe signature against a secret held server-side. Record processed Stripe event IDs and payment intent/session IDs uniquely; repeated or out-of-order events must be safe.
5. Keep `paid_unfulfilled` separate from `active_membership`: payment alone **does not** authorize access before approved product release gates are met.
6. Provide truthful receipt/confirmation and a customer-support path; never claim app activation based on return URL success or an unverified client event.
7. Track refunds/disputes and update order obligations; reconcile financial records, entitlements, and Stripe state. Do not delete history.
8. Refunds, consent to save cards, and future recurring subscriptions require distinct documented terms and authorization. One-time prepaid prices must not silently auto-renew.

## Data protection & release gates
- Use Stripe-hosted payment fields; never collect, log, or store raw card numbers/CVC in Groundwork.
- Use least-privilege credentials for server integration; never embed Stripe secret keys or webhook signing secrets in GitHub Pages JavaScript.
- Identity linking to the application requires explicit review of its actual deployed code and auth flow; no connection to production users without founder approval.
- Add a separate secured backend or approved existing backend integration before using live payments. Github Pages is static and cannot verify signatures or enforce entitlements.
- Use Stripe sandbox simulations for success, failed payment, canceled checkout, duplicate webhook, delayed settlement, refunds and mismatched price, plus independent review of taxes for registered jurisdictions.
- Do not launch payment links until South Carolina Retail License issuance/effective date, Stripe Tax registration/setup, published terms/delay/refund policy, support contact, and entitlement/fulfillment process are verified.

## Important commercial boundary
Founding Access remains a **free reservation** (30-day free period after activation, planned $7.99/month for first 12 paid months), not a prepaid customer payment. Organization pilot/sponsorships are separate from consumer checkout. The intended public launch date is not itself a guaranteed paid activation date.

## Next implementation work (requires deliberate integration decision)
- Choose where verified webhook processing and purchase records will live (Cloudflare Worker or a separate secured backend), reconciling actual app infrastructure first.
- Finalize pre-purchase offer semantics and customer terms before taking real money.
- Test a complete sandbox checkout only after tax settings are configured. Deactivated links should remain inactive when testing ends.
