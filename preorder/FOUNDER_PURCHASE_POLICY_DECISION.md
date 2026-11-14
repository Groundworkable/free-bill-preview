# Groundwork individual purchase policy — founder decision gate

**STATUS: REVIEW DRAFT, NOT APPROVED OR PUBLISHED. November 14, 2026.**
This document narrows the remaining commercial decisions. It does not change any public pages, customer terms, Stripe settings, or the isolated Cloudflare Worker. All payment and tax safeguards remain disabled.

## Verified offer structure, not an offer to the public

| Item | Currently configured in isolated Stripe sandbox | Meaning |
|---|---|---|
| Monthly | $9.99 USD base, one-time, tax exclusive | One future month of standard Groundwork access, **not** an automatically renewing monthly subscription |
| Annual | $96 USD base, one-time, tax exclusive | Twelve future months of standard Groundwork access, **not** an automatically renewing annual subscription |
| Founding Access | No payment requested here | Separate free reservation, 30 days free after activation, then $7.99 per paid month for twelve months only under a separately approved recurring contract |
| Advanced / Assets & Inventory / Marketplace | Not included | No promise of availability or launch dates |

The one-time Stripe products currently in the sandbox must not be described as continuing memberships; the pre-purchase terms must explicitly distinguish future duration from recurring charges.

## Founder choices required before any pre-sale

### Decision A — Should customers pay before application access exists?

- **A1 — No paid pre-orders yet (least risk).** Keep Founding Access reservations free. Offer standard membership checkout only after real access and delivery flow are verified. This would require replacing the current *future-access* policy with a delivered-access policy before turning on checkout.
- **A2 — Permit prepaid future access.** Retain the current one-time $9.99 / $96 sandbox offers, but disclose a credible written estimated delivery/activation window, explicit customer cancellation/refund rights and who sends activation notices.

**No choice presumed.** The public website target of January 1, 2027 is *not* a commitment for the paid application's release.

### Decision B — If A2, specify a transparent delivery promise

Confirm all of these before sending customers to Stripe:
- The **earliest** paid-access activation date and latest **promised** activation date, based on verified application readiness, not the marketing site launch.
- The customer delivery method, including what constitutes confirmed access, how customers receive instructions, and who reconciles orders.
- The date at which a customer is notified of delays, the revised estimate communicated, and the response/refund process.
- How the seller handles unfulfilled orders if no activation is possible by the deadline.

**Conservative draft default for review:** allow customer-initiated full refund at any time before paid term actually begins; if the seller cannot honor the promised activation date, notify immediately, provide cancellation/refund options, and refund without delay where law or agreed policy requires. Exact deadline and automatic-refund triggers remain **UNAPPROVED**.

### Decision C — Post-activation refunds

Specify whether the 1-month or 12-month nonrenewing prepaid term can be canceled for a refund after activation; if yes, how unused time is calculated; always preserve statutory rights. **Unapproved.** No invented no-refunds clause.

### Decision D — Support and privacy

- `privacy.html` is currently `privacy-v1`, effective October 3, 2026, and focuses on the public site and invitation-only beta. It names existing infrastructure providers but does **not yet explicitly describe** Stripe-paid checkout, payment confirmations, order reconciliation, refund/dispute records, retention, or the seller's support responsibilities for paid pre-purchases.
- That existing page publishes `hello@groundworkbyable.com` for privacy requests; functioning delivery and the customer-support workflow have **not** been verified.
- A revised privacy-policy draft must be reviewed and published before charging customers. No personal address should be copied into public legal/checkout fields without understanding which fields Stripe actually exposes.

### Decision E — Taxes and license

**Observed in Stripe sandbox on Nov 14, 2026:** Tax settings status `pending`; `head_office` missing; zero registrations; both test links have `automatic_tax.enabled=true` and `tax_behavior=exclusive`. Stripe's automatic tax cannot be relied on until completed and legally applicable tax registration is verified.

**South Carolina source context (not personalized tax advice):**
- SCDOR's Retail License guidance says taxable retail sales require the appropriate license before making such sales; a $50 application fee alone is not proof of issuance.
  - https://www.dor.sc.gov/businesses/apply-business-tax-account/licensing-retail-license
  - https://www.dor.sc.gov/businesses/apply-business-tax-account
- SCDOR's 2025 Sales & Use Tax Manual, Chapter 17, and a fact-specific 2020 private letter ruling address potentially taxable online software-as-a-service (ASP) subscriptions. The private ruling is not a determination about Groundwork itself.
  - https://dor.sc.gov/sites/dor/files/Documents/Policy%20Manuals/Chapter%2017%20-%20Communications.pdf
  - https://dor.sc.gov/sites/dor/files/policies/PLR20-1.pdf
- Confirm taxable classification of **these specific sales**, SC registration and any other nexus/registrations with SCDOR or a qualified tax adviser. Stripe Tax is calculation software, not tax registration.

Stripe Tax's head-office address must be accurate and entered privately. Verify account business/public support settings separately to avoid publishing the founder's residential address.

## Ordered readiness gates — no implied authorization

1. Resolve **Decision A**, then B/C if selling future access.
2. Review final terms, privacy/payment disclosure, support method, and consumer cancellation/refund process; obtain appropriate professional review.
3. Confirm retail-license approval/effective date and tax obligations, add accurate head office and any verified registrations in Stripe.
4. Set approved public Stripe terms URL and enforce checkout consent on both **test** Payment Links. Confirm disabled-state safety first.
5. Explicitly authorize a temporary isolated **sandbox-only** purchase test. Verify Stripe-signed events, D1 order, duplicate/idempotent handling, no user activation, and refund/dispute behavior as applicable.
6. Re-disable test checkout and document results. Live charges, site PR merge, public terms publication, and app activation require **separate** release approval.

**Current required response from founder:** A1 or A2. No policy approval follows from the phrase "onward."
