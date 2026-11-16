# Groundwork by Able — Pre-purchase activation delivery approach

**Founder decision recorded November 16, 2026: APPROVED DESIGN DIRECTION ONLY.**

The founder approved **an email invitation directing a verified pre-purchaser to sign in or create a Groundwork account, with purchased membership access applied only after the application is verified ready**.

This is approval of the delivery **approach**, **not** authorization to implement app authentication, send emails, issue entitlements, modify existing approved legal wording, publish customer terms, activate Stripe links or collect funds. Specific security, customer-support, calendar and operational procedures below are **design proposals requiring technical/legal verification**, not independently founder-approved details.

## Agreed customer experience

1. **Pre-purchase is separate from activation.** A completed payment is independently verified server-side against Stripe and retained as `paid_unfulfilled`; no membership is granted on payment, receipt, checkout redirect or marketing signup alone.
2. **Payment confirmation and access invitation are distinct.** A truthful pre-purchase confirmation can explain what was purchased, the payment reference and future-access status **only after notification infrastructure and customer delivery copy are separately approved**. It must not imply the product is usable. No message is sent automatically as a result of this decision.
3. **Invitation only when usable access is verified.** After the approved application is available to that purchaser's cohort, an authorized transactional email invitation directs the buyer to sign in or create a Groundwork account. An invitation is not itself proof of successful delivery or account activation.
4. **Secure account and purchase association is required.** An authenticated account must be linked to a verified Stripe purchase through a separately designed secure claim method, with proof of mailbox/account control and protection against mismatched addresses, duplicate redemptions, replay, forwarded links, multi-account claims and unauthorized reassignment. A matching email string, user-entered checkout ID or browser redirect alone must **never** confer access.
5. **Purchased access only after readiness and verification.** The future fulfillment service must independently confirm the application is usable, the exact purchase/term belongs to the verified claimant, refund/dispute eligibility is handled, and the cohort calendar is correct. Only then may a new, separately authorized entitlement be applied. **Nothing in the current isolated payment D1 automatically grants app access.**
6. **Buyer can see an accurate activation record.** The planned customer-facing experience should show purchased offer, paid term, any complimentary preview/bonus, actual usable access-start date, service-through date, and support/refund options. No automatic subscription or saved-card permission follows from a one-time pre-purchase.

## Calendar and customer-rights constraints already decided

- **Official target:** January 1, 2027 for paid application release. Conditional complimentary founders' preview **on or after December 14, 2026** only if verified ready. Preview does **not** consume purchased service time or the February bonus.
- **Monthly advance:** one paid month (on-target January 2027); February 2027 complimentary if usable paid service starts January 1. Future paid membership requires separate new authorization, never automatic renewal.
- **Annual advance:** **12 purchased months plus a separate complimentary February 2027**, on-target purchased January 2027 and March 2027–January 2028, covering through January 31, 2028. No shortening of purchased time if usable access opens later.
- **Late or unavailable access:** a sent/received invitation, calendar date, Stripe receipt or unclaimed invitation cannot by itself start the paid-service or seven-day refund clock. Establish and verify when the purchaser **actually has usable purchased access** before consuming months. This exact activation-timestamp rule remains an engineering and legal review item, not a finalized automation.
- **Customer resolution:** preserve the previously approved December 18 readiness update, January 1 delay notification if needed, January 8 unresolved-order follow-up and **January 15, 2027** undelivered-order resolution cutoff (delivered usable access, affirmative specifically dated extension, or cancellation/full refund initiated within the existing agreed timeline); silence is not extension consent.
- **Refunds:** preserve full pre-activation refund availability and the approved first-seven-calendar-day-after-actual-usable-paid-start voluntary full-refund window; more protective statutory rights prevail.
- **Unclaimed invitations:** separately establish outreach/verification, support, refund/delay handling and proof of actual access. **Do not treat non-claim or nonresponse as fulfillment**, delivery-date extension, consent to charge, or a reason to deplete purchased service.

## Proposed technical gates before implementation (not yet approved or built)

| Gate | Required independent evidence |
| --- | --- |
| G1 — source of payment | Authenticated provider-confirmed Stripe test purchase, signed webhook, matching price/amount/currency/accepted terms, isolated immutable `paid_unfulfilled` record; do not use synthetic D1 notices as proof of a real purchase |
| G2 — verified recipient | Secure purchaser/account claim and authorization rules; no plaintext recipient added to current isolated D1 without separate privacy/schema approval |
| G3 — product readiness | Release owner verifies app/login, the purchased paid feature set, access paths, and support availability for the actual cohort; no readiness inferred from target dates |
| G4 — customer messaging | Approved transactional invitation and confirmation templates, controlled delivery provider, bounce/support procedures, idempotency, consent separation and evidence of send/delivery; do not turn on Resend dispatch |
| G5 — entitlement service | Separately reviewed/app-approved entitlement mechanism, atomic one-time claim, zero overlap/double grant, revocation/refund and immutable audit history; no existing app implementation assumed |
| G6 — service clock | Verified actual usable paid start, cohort rules and courtesy months, delayed and mid-month calculations, customer-facing confirmation, refunds and resolution cutoff |
| G7 — launch/legal | Final legally reviewed published customer terms/privacy, approved version and URL, appropriate Stripe hosted consent, tax/retail obligations, successful authorized end-to-end sandbox evidence and separate launch approval |

**Test matrix proposed:** valid signed prepaid monthly/annual purchase; wrong account/email; forwarded/replayed/expired invitation; duplicate claims; invitation before readiness; invitation sent but undelivered; unclaimed account; refund before activation; partial refund/chargeback; app login failure; delayed launch; mid-month usable start; February bonus; account deletion; delivery and activation evidence disagreement. Assert no silent entitlement, no early clock start and no repeat billing.

## Integration boundaries and next decision

- Existing Groundwork app auth/user-management flows, release-readiness evidence and database schema **must be inspected before choosing any concrete account-linking or entitlement design**. Do not assume current app account identities match Stripe checkout emails.
- Existing founder notification Worker is a separate, Access-protected service; the production status-only route works, but review and dispatch are disabled. A successful mock Workerd/D1 handoff test **does not** mean real purchase confirmation or invitation sending is operational.
- **No app/source implementation, Cloudflare variable/binding, Stripe account setting, Resend send/template publication, migration, legal copy change, paid link activation or live deployment authorized.**
- The next work may be **planning-only** reconciliation of this direction against the app's actual authentication and paid-membership model, and separately final legal review of any proposed customer-facing publication copy. Material wording changes require new founder approval.

**Related approved customer copy (unaltered):** `preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md`; `preorder/PAYMENT_FULFILLMENT_GATE.md`. The approved copy remains **NOT EFFECTIVE**, `TERMS_VERSION=UNAPPROVED`, no publication or customer contract activation.
