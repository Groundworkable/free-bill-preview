# Refund operations — internal review draft

Status: preparation only; not a deployed workflow, customer contract or authorization to issue refunds. Existing founder-approved policies control. No private customer, tax or payment evidence is included.

## Separate responsibilities

- Policy determines eligibility and refundable amount.
- An authorized operator initiates the approved refund through the payment provider.
- Notification journaling records provider-reported changes; it neither initiates a refund nor proves customer bank receipt.
- Reconciliation verifies the provider refund state against the request and purchase. The current draft receiver is a journal, not a reconciler.

## Proposed operator sequence

1. Receive the request through a verified monitored support channel. Record receipt time and an internal case reference. Do not ask for card numbers or CVC.
2. Verify the buyer/order association without disclosing another customer's purchase. Locate the original payment and check previous refunds and any dispute before taking action.
3. Establish whether usable paid access actually began. Complimentary preview time is not paid-term commencement. Preserve the recorded start date and the terms applicable to that purchase.
4. Apply the approved policy: full refund before paid access, full voluntary refund in the first seven paid calendar days, then unused full annual purchased months at $8 base per month. The free bonus month is not purchased time. Other applicable rights require review; do not automatically deny them.
5. Verify the refundable remainder against provider records, including tax treatment. Do not calculate tax by guessing a percentage or refund more than the remaining paid amount. Partial periods, disputed payments and uncertain activation need operator review.
6. Record the approved amount, reason, reviewer and intended original payment. Resolve uncertain previous attempts before retrying. A future API implementation must use a stable operation reference and provider idempotency controls; these are not implemented here.
7. Initiate only in the authorized environment. Capture the provider refund identifier and returned status. Do not mark a pending or failed refund as complete or initiate a second refund merely because delivery of a notification was delayed.
8. Reconcile later notifications by refund identifier and original payment. Event snapshots must not be summed as separate refunds, and arrival order alone must not determine current state. Where uncertain, verify authoritative provider state.
9. Send factual customer confirmation distinguishing request received, refund initiated, pending, succeeded or failed. Do not claim bank receipt from a webhook alone. Notification sending and support delivery are not yet verified.
10. Retain the audit record and purchase evidence. Any future membership cancellation must follow a separately reviewed integration; this receiver changes no entitlements.

## Approved non-delivery cutoff

January 1, 2027 remains the application launch target; January 8 is the unresolved-order follow-up. By January 15, an undelivered pre-purchase requires usable delivery, affirmative agreement to a specific later date, or cancellation with full refund initiated within five business days. Silence is not consent. Preserve the full purchased term and bonus when delivery shifts.

An operational calendar must define the timezone, applicable business-day/holiday treatment, responsible operator, escalation and evidence of each notice. Do not invent a final calendar date from an undefined holiday convention.

## Evidence required before calling refunds operational

- Verified support intake and buyer/order verification.
- Exact paid-term commencement and remaining purchased months.
- Founder-approved planning standard: initiate eligible ordinary refunds within **five business days after receipt of the request and customer/order verification**, separate from the seven-calendar-day full-refund eligibility window. Verify timestamping, exception escalation and actual execution before treating this as operational.
- Confirmed tax adjustments and provider refundable remainder.
- Sandbox refund initiation, pending/success/failure handling and uncertain retry tested.
- One refund operation reconciled across request, provider and journal, including duplicate/out-of-order deliveries.
- Safe treatment of a dispute and an existing refund, without duplicate repayment.
- Verified customer notice delivery and exception handling.
- Verified reserve/funding process and named operator.

## Current limits and release boundary

This document is a review checklist, not implementation evidence. Refund execution, current-state reconciliation, customer notices, support verification and remote end-to-end testing remain incomplete. Database-level append-only enforcement remains unfinished. Payment activation, publication, merge, deployment, schema application and application changes remain outside this preparation step.


## Founder-provided contact routing — November 14, 2026

The founder showed the mailbox alias administration page for `hello@groundworkbyable.com`, including newly created `billing@groundworkbyable.com` and existing `support@groundworkbyable.com` aliases. The aliases share the same underlying inbox; they are not independent queues or accounts.

- Proposed dedicated billing, payment and refund contact: `billing@groundworkbyable.com`.
- General application/account assistance: `support@groundworkbyable.com`.
- General company contact: `hello@groundworkbyable.com`.
- Before making these operational/customer-facing promises, verify inbound delivery, reply-from-alias identity, who monitors the shared inbox, response tracking and a complete test of the refund intake and follow-up process.

This is founder-provided account configuration evidence, **not proof of sent/received email**, a live support SLA or approval to publish legal terms. Public checkout, remote webhook and refund operations remain disabled/unverified.

### Billing contact test — founder-reported November 14, 2026

The founder confirmed that the test of `billing@groundworkbyable.com` worked following instructions to check inbound delivery and reply using the billing alias. This is **founder-reported verification**, not an independently inspected mail-delivery log or an operational support SLA. The shared `hello@groundworkbyable.com` inbox still requires routine monitoring, case tracking, and support-process testing before checkout goes live.
