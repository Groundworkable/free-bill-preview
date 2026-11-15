# Groundwork customer purchase notifications — draft-only checkpoint

**Prepared November 15, 2026 (US Eastern). No messages sent, no template published, no payment processing enabled.**

## Resend connected account — read-only readiness check

- Resend sending domain: `groundworkbyable.com` — **verified**; sending **enabled**. Receiving through Resend **disabled**; the founder has separately tested shared-inbox inbound alias routing for `billing@` and `business@`.
- Resend contained **zero templates** before this work. The three templates below were created as **drafts** only; no publish action and no send action was taken.
- Default From: `Groundwork by Able <billing@groundworkbyable.com>`; Reply-To: `billing@groundworkbyable.com`.
- The sending domain's verification is not evidence that a buyer can receive a message or that replies/cases are properly handled. A controlled outbound test must be authorized and independently checked later.

## Draft template inventory (Resend)

| Purpose | Resend template ID | Status |
| --- | --- | --- |
| One-time purchase confirmation | `9e7fdf05-a547-4b9d-82f6-3251574ef27f` | Draft, unpublished |
| Pre-purchase delivery status/update | `b76db4ed-07d4-4b1a-9231-abb426379ec5` | Draft, unpublished |
| Refund initiated (not refund completed) | `d1976df7-1215-4e74-807c-093d5fe9b9b2` | Draft, unpublished |

Drafts are editable under `https://resend.com/templates`; their IDs above are exact, not invented.

### Template data contracts

**Purchase confirmation:** `ORDER_REFERENCE`, `OFFER_NAME`, `SUBTOTAL`, `TAX`, `TOTAL_PAID`, `ACCESS_SCHEDULE`.

**Delivery status:** `ORDER_REFERENCE`, `UPDATE_DATE`, `DELIVERY_STATUS`, `NEXT_STEP`.

**Refund initiated:** `ORDER_REFERENCE`, `REFUND_REFERENCE`, `REFUND_AMOUNT`, `INITIATED_DATE`.

The prepared content says a payment receipt **does not grant paid app access**; a purchase **does not authorize auto-renewal**; pre-activation refunds and post-activation voluntary seven-day full refund eligibility remain distinct; January 15, 2027 unresolved-order deadline is a **resolution cutoff**, not an app launch promise; initiated refunds do **not** imply bank settlement.

## Required gates before **any** delivery to a customer

1. Founder/legal review of transactional wording and exact link to the published approved customer terms and refund policy. Do not publish these drafts as binding contractual communications until approved.
2. Do not infer `to:` address from isolated D1: it stores **no purchaser email**. Obtain it from an independently authenticated Stripe provider record or separately verified customer contact process. Compare IDs, amounts, consent and terms version with immutable D1 order. The offline `purchase_contact_check.py` helps flag inconsistencies but is **not identity authentication** and does **not authorize messaging**.
3. Verify no conflicting contact emails, ensure address belongs to purchase and delivery method is permitted; prevent leaks, duplicate sends, unauthorized entitlement or unsolicited marketing.
4. Confirm amount, tax, original purchase schedule and actual app-access readiness from reliable records. No invented date; delayed/partial activation calendar requires separate implementation verification.
5. Refund notice requires **independent provider confirmation** that refund has actually been initiated, refund ID, amount and initiation date. Never send it for a merely requested, queued or disputed refund.
6. Design approved notification triggers, retry/deduplication, suppression on cancellation, bounce/complaint handling, delivery logs, minimum-retention recordkeeping, and manual support escalation. All are **not implemented** by draft templates.
7. Conduct controlled tests using sandbox provider events and founder-controlled inbox with explicit authorization; confirm delivery and matching identifiers/amounts without exposing card data.

**Safety:** Resend templates are still drafts; no payment URLs, Stripe Payment Links, webhooks, Cloudflare Worker flags, public pages, Groundwork app entitlements, or subscription billing settings were changed.
