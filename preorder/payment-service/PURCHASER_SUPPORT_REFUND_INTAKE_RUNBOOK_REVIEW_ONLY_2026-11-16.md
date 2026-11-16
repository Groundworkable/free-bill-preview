# Groundwork by Able — Purchaser Support, Delivery Problems and Refund Intake

**Status:** INTERNAL OPERATIONS REVIEW DRAFT — NOT AN ACTIVE CUSTOMER SERVICE, REFUND AUTHORIZATION, LICENSE CLEARANCE OR CUSTOMER CONTRACT  
**Prepared:** November 16, 2026 · Able Systems LLC · Draft PR #17

**Purpose:** Resolve the concrete operational gap flagged as **OPEN BEFORE PUBLICATION** in `preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md`: how a purchaser contacts the company, how the company verifies an order and buyer, how to handle refunds/delays fairly, and what evidence the business must keep. This document is a manual *proposal for later review*, not a staffed/operational process.

The founder already submitted and paid the **$50 South Carolina Retail License application November 13, 2026**. **Do not apply or pay again.** Actual issuance/effective date remains to be confirmed. No live customer checkout or membership activation is authorized.

## 1. Current state — no actual customer support workflow deployed

- Existing support addresses in founder-approved Terms: **billing@groundworkbyable.com** for payments/refunds/cancellation, **support@groundworkbyable.com** for account help, **hello@groundworkbyable.com** for general inquiries. These aliases share a mailbox. Billing delivery was previously founder-reported tested, but **managed support-case tracking and delivery are not independently verified**.
- Stripe TEST account holds two **inactive** one-time links. The connected account's prior verified TEST inventory contained **zero real paid Checkout Sessions**. The isolated Stripe/D1 receiver and review outbox are not an operational order fulfillment, customer notification, or refund service.
- Resend already has an **unpublished refund-initiated draft**; there is no reason to duplicate it. Customer emails must not be sent without separate approval of sender, wording, operational controls and per-case authorization.
- The existing code is strictly **offline and TEST-only**: `purchase_contact_check.py` compares authenticated-provider snapshots as supplied by a caller but cannot prove that they were genuinely fetched or that a mailbox is controlled; `refund_case_preflight.draft.py` rejects mismatches and produces **base-only arithmetic for a human**, never authorization; `refund_deadline_preflight.draft.py` requires a verified business closure calendar. **A favorable code result is not approval to issue money.**

## 2. Proposed triage from first contact

| Stage | Proposed operator action | Never do |
| --- | --- | --- |
| **1. Capture** | Record receipt time (with timezone), channel, issue category, support owner, internal case reference and the customer's requested remedy in a restricted case system *once separately authorized*. Retain original inquiry privately. | Do not paste names, emails, order IDs, message contents, receipt images, card fragments or secrets into public GitHub PRs, CI logs, analytics or open chat transcripts. |
| **2. Acknowledge** | Promptly explain the inquiry is being reviewed and that identity and purchase details may need verification. Give the billing contact and avoid promising a refund before checking facts. | Do not claim the membership has started or the refund was issued merely because a request was received. |
| **3. Locate** | Privately look up the purchase with **independently authenticated Stripe provider data**, confirm TEST vs LIVE, one-time offer, paid/refunded/disputed status, amount including tax and terms version, then reconcile with corresponding isolated order/journal where applicable. | Do not trust a screenshot, email address, claimed checkout ID, static success URL or caller-asserted `provider_verified=True` as sufficient authority. |
| **4. Verify requester** | Use a separately approved proof-of-account/mailbox-control and purchaser-association procedure. Conflicts or forwarded invitations go to a restricted manual identity review. If purchase is real but requester differs from buyer, do not disclose order details. | Do not treat matching emails alone as proof of ownership, request full card numbers, CVC, passwords, or send a claimant a raw private purchase token. |
| **5. Classify** | One of: `preactivation_cancel`, `first_seven_days_full`, `later_annual_unused_paid_months`, `later_monthly_used`, `delivery_or_defect`, `dispute_or_duplicate`, `unclaimed_invitation`, `identity_or_payment_uncertain`, or `statutory_exception`. | Do not apply ordinary voluntary prorating to undelivered service, defective service, disputes, unknown dates or other protected-rights claims. |
| **6. Verify service clock** | Obtain independent evidence that the *specific buyer actually had usable purchased paid access*. Distinguish email invitation, account claim, optional preview, product-ready cohort and paid service start. | Do not start a paid month or the seven-day voluntary full-refund period from a receipt, marketing email, invitation dispatch, account creation, or launch target alone. |
| **7. Determine remedy** | Use approved purchase Terms and applicable law; for the on-time January schedule, consult offline calculation only as an **illustration** with manual tax and provider review. Delayed/mid-month clock remains **unapproved**. | Do not automatically calculate a dollar refund from a hypothetical late schedule or let a model/test function initiate a Stripe refund. |
| **8. Authorize/execute** | Future production: separate verified operator approval and provider-side refund action to **original payment method where supported**, with confirmation of provider response and internal case log. At present, this stage is **NOT IMPLEMENTED OR AUTHORIZED**. | Do not issue refunds, debit funds, change Stripe settings, release held money, send email or revoke access merely from this draft. |
| **9. Follow through** | Track the provider refund's actual status until settled, any tax reconciliation, notification approval, membership entitlement effect, support follow-up and closure. Record **initiated ≠ money received**. | Do not mark case paid/closed from `pending` alone or silently remove financial evidence on account deletion. |

### Minimum private case fields — proposed, not a database schema

- Internal case reference; private original message location; received-at (UTC and customer timezone if known); issue classification; requested remedy; assigned operator and escalation owner.
- Authenticated **provider-verified** purchase reference / Stripe object IDs, offer, original amount, tax, paid status, payment/dispute/refund snapshot verification time; source of truth. These must stay in a *restricted* system, not public repository.
- Proven purchaser verification method and outcome only (avoid unnecessary raw identity materials), and any mismatches/exception handling.
- Actual paid-usable access verification time **or explicitly `NOT_VERIFIED`**, purchased term, complimentary preview/bonus, proposed remedy, statutory exception, and tax review.
- Release/legal/management approval record if required, decision time, deadline basis, provider refund operation/reference/status, customer notification evidence, and case closure.
- Retention/deletion rules require legal/privacy review; do not store this data in existing order D1 or app Supabase tables without a separately approved schema and access policy.

## 3. Approved commercial boundaries (do not reinterpret)

| Situation | Founder-approved planning rule from customer Terms | Status / operator action |
| --- | --- | --- |
| **Before usable purchased paid access** | Customer can request **full pre-purchase refund**, including legally refundable applicable taxes. Conditional free preview does not consume this right. | Verify order and requester, preserve the request receipt time, and route to human review; no automated refund. |
| **First seven calendar days starting when actually usable paid membership begins** | Eligible full **voluntary** refund; time does not begin merely with an email, signup or December preview. | Must verify actual usable start. Do not promise a clock when no paid entitlement exists. |
| **Later annual voluntary cancellation** | **$8 before tax adjustments per entirely unused future purchased month**; February complimentary month is never a paid month. | Count only valid on-time purchased months; check other protected remedies. Unknown/delayed starts go to manual review. |
| **Later monthly voluntary cancellation** | Ordinarily no partial-month voluntary refund for used $9.99 monthly term after initial seven days. | Do not apply this to failure to deliver service or non-waivable statutory rights. |
| **Ordinary eligible verified refund processing** | Planning standard: **initiate through processor within five business days after request has been received and purchaser/order verified**. | Log both milestones; do not let an unresolved fraud/identity exception become an indefinite unrecorded hold. Do not assume weekday-only calendars resolve holidays. |
| **Undelivered on Jan 15, 2027 without affirmative dated extension** | Actual usable delivery, documented purchaser agreement to specific extension, **or cancel with full refund initiated within five business days of Jan 15 cutoff**. Silence is not consent. | This is a *resolution deadline*, not permission to declare January 15 a new launch date. Preserve earlier legal remedies. |
| **Refund provider says `pending`** | Initiation is not receipt in customer's bank. | Track Stripe outcome and any insufficient-balance/failure state, and inform buyer accurately when separately authorized. |
| **Account deleted / lost access / unclaimed invite** | Never consume purchased service merely because an invitation was sent or buyer did not claim it. | Escalate identity, refund and retention to manual resolution. Preserve only lawfully required records, independent of app-user deletion. |

## 4. Operational readiness checklist — all presently unresolved

- [ ] A private, access-controlled case tracker and restricted audit trail exists, with a named owner, coverage/backup, retention, and safe storage. **Not evidenced.**
- [ ] Actual `billing@` and `support@` inbound handling, replies, unauthorized-sender / bounce path and documented monitoring are independently exercised; prior reported inbox delivery is not equivalent to staffing. **Not evidenced.**
- [ ] A **provider-authenticated** order lookup, customer contact reconciliation and separate purchaser identity proof exist; the current Python `provider_verified` assertion is not enough. **Not evidenced.**
- [ ] An approved live/tax-aware refund authorization process with second-person review or documented compensating sole-owner control (as appropriate), audit and original-method refund execution exists. **Not evidenced.**
- [ ] The actual usable-paid clock is verifiable against account membership; late/midmonth schedule and unclaimed invitation handling are approved. **Not evidenced.**
- [ ] Tax adjustments, disputed charges, duplicate payments, reversals, provider funds reserve, and legally required remedies are covered. **Not evidenced.**
- [ ] Plain-language refund acknowledgement, buyer verification request, delay response and refund initiated/completed templates receive separate communications approval and sending authorization. **Not evidenced; existing Resend refund template is a draft only.**
- [ ] Policy, operational resources and notifications can meet **January 15** unresolved-delivery cutoff and prompt ordinary refund initiation once an actual pre-purchase is accepted. **Not evidenced.**
- [ ] Actual SC Retail License approval/effective date and applicable tax registration/collection reviewed. **Application/fee already completed November 13; DO NOT duplicate.**
- [ ] Pre-purchase Terms and Privacy V2 legally reviewed and expressly published with true version/effective date, Stripe Terms acceptance correctly configured; actual TEST transaction and end-to-end support case verified. **Not yet.**

**No customer-facing checkout may rely on this review draft to claim support, refunds or fulfillment are operational.**

## 5. Proposed safe dry-run drill *before* real buyers (not executed here)

In a **controlled, separately authorized TEST-only** exercise, use one independently authenticated Stripe TEST purchase, verify the same order in isolated D1, submit a fictional but time-stamped intake request through the intended support channel, verify identity safely, obtain an actual membership usability state, log a human-reviewed refund decision, then process a separately authorized **TEST** refund and reconcile the provider return (initiated versus completed). Test a bad address, wrong purchaser, missing terms, held Stripe refund, delivery delay and a customer who never claims an invitation. Never substitute an invented synthetic D1 fixture for a true paid Checkout. No real customers or real money.

## 6. Exact existing source boundaries

- Founder-approved (but unpublished) customer terms: `preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md`, sections **3–5**.
- Verified-order vs claimant contact: `preorder/payment-service/purchase_contact_check.py` — **pure caller-asserted, PII-safe diagnostic**; cannot prove provider snapshot or mailbox.
- Financial and requested refund triage: `preorder/payment-service/refund_case_preflight.draft.py`, `refund_reconciliation.py`, `refund_policy_quote.draft.py`.
- Verification-sensitive five-business-day estimate and Jan 15 cutoff: `preorder/payment-service/refund_deadline_preflight.draft.py`.
- Access invitation approach: `preorder/ACTIVATION_DELIVERY_APPROVED_APPROACH_2026-11-16.md`; actual secure claim/membership system **not implemented**.
- Existing Resend refund-initiated message remains **draft and unpublished**; other transactional templates likewise disabled.

**No changes by this document** to hosted customer site, Stripe Payment Links, tax registration, Cloudflare/D1, Supabase, Resend, refunds, membership, case data, legal terms or existing CI. This handoff is **not founder approval** to operate a service.
