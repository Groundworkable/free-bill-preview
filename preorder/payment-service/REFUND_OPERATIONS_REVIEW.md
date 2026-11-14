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
- Agreed voluntary-request processing deadline; the approved January 15 automatic-resolution rule does not settle every request-processing detail.
- Confirmed tax adjustments and provider refundable remainder.
- Sandbox refund initiation, pending/success/failure handling and uncertain retry tested.
- One refund operation reconciled across request, provider and journal, including duplicate/out-of-order deliveries.
- Safe treatment of a dispute and an existing refund, without duplicate repayment.
- Verified customer notice delivery and exception handling.
- Verified reserve/funding process and named operator.

## Current limits and release boundary

This document is a review checklist, not implementation evidence. Refund execution, current-state reconciliation, customer notices, support verification and remote end-to-end testing remain incomplete. Database-level append-only enforcement remains unfinished. Payment activation, publication, merge, deployment, schema application and application changes remain outside this preparation step.
