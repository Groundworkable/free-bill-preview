# Groundwork by Able — Paid Pre-purchase Activation Invitation (REVIEW COPY)

**Status:** INTERNAL DRAFT ONLY — NOT APPROVED FOR SENDING, NOT PUBLISHED IN RESEND, NOT A LIVE TEMPLATE.  
**Date:** November 16, 2026  
**Owner:** Able Systems LLC (Groundwork by Able)  
**Reason:** Founder approved the high-level experience of inviting verified pre-purchasers by email to sign in or create an account when Groundwork's paid service is verified ready. This file is a proposed transactional message, not additional authorization for delivery or fulfillment.

## Proposed customer email — plain text

**Subject:** Your Groundwork access invitation  
**Preview text:** Verify your account to complete the next step toward your prepaid membership.  
**From (proposed):** Groundwork by Able <support@groundworkbyable.com>  
**Reply-to:** support@groundworkbyable.com

Groundwork by Able

Your Groundwork membership invitation

Groundwork has verified that the paid application is ready to offer access for your purchase. Your one-time pre-purchase is still separate from account verification and activation.

**Purchase reference:** {{PURCHASE_REFERENCE}}  
**Purchased offer:** {{OFFER_NAME}}

**Next step:** Sign in to your Groundwork account, or create one if you do not already have an account, using your private activation invitation:

{{PRIVATE_ACTIVATION_URL}}

This invitation is for account verification. Receiving or opening this email does not, by itself, mean your paid membership has started. Groundwork will confirm your purchased access and actual usable start date after your identity and purchase are securely linked and access is verified.

**Your purchased membership and complimentary time:** {{VERIFIED_ACCESS_SCHEDULE}}

Your one-time pre-purchase does not authorize automatic renewal. Any later purchase requires a new, separate authorization.

If you did not expect this invitation, cannot verify your account, or the link has expired, contact support@groundworkbyable.com. Do not share or forward your private invitation. You can request a full refund before usable paid access begins by contacting billing@groundworkbyable.com with your purchase reference. Do not send card details.

Groundwork by Able  
Able Systems LLC

---

## Dynamic placeholders (no synthetic values in customer message)

| Placeholder | Trusted origin / required check | Never source from |
| --- | --- | --- |
| `{{PURCHASE_REFERENCE}}` | Authenticated, independently provider-verified one-time Stripe order (safe reference for support, not an activation credential) | Unverified browser redirect or manually submitted ID as proof |
| `{{OFFER_NAME}}` | Validated purchase term: standard monthly or standard annual, read from trusted order | User-editable profile or free Founding Access reservations |
| `{{PRIVATE_ACTIVATION_URL}}` | New, separately reviewed and implemented server-issued, short-lived, single-use, bound-to-verified-purchaser claim invitation. The exact URL path is **NOT IMPLEMENTED**. Must not be written to analytics, public files, durable logs or ordinary email template source | Existing `/auth?mode=invite` beta-terms password completion route or a guessed/static URL |
| `{{VERIFIED_ACCESS_SCHEDULE}}` | Approved calculation of all purchased time and separate complimentary February entitlement for the exact actual usable cohort. For a delayed or mid-month start, the adjusted calendar **is not yet approved**, so sending must remain blocked | Hardcoded January 1 start, a sent date or guessed late launch date |

**Do not create a clickable public activation URL in this draft.** The private invitation URL is generated for one independently verified purchaser at an authorized send, never in advance in source, PR comments, screenshots or a published template sample.

## Release checklist — all must be independently evidenced

1. **Actual paid feature readiness:** A named release owner attests the live paid app, login, support, and the purchaser's cohort are genuinely usable. A target date or successful CI cannot substitute.
2. **Real purchase:** Checkout is verified independently using Stripe's authoritative provider API; accepted published terms, precise price/offer/tax, one-time payment, no refund or open dispute; only a trusted checkout record can be invited.
3. **Identity protection:** Account association/claim service is implemented and security-reviewed against forwarding, mismatched emails, replay, multiple accounts, expired links and simultaneous claims. Invitation cannot grant access on receipt; email string equality is not sufficient.
4. **Calendar:** Purchased months and the additional February month are preserved; actual usable start date drives first-seven-day refund clock. Unclaimed invitation does not automatically consume membership. For any late start, require separately approved dates.
5. **Message operations:** Transactional template receives explicit copy/variable approval, approved from-domain, actual recipient verification, delivery and bounce monitoring, resend/revocation handling, and a single dispatch authorization. Customer contacts remain separate from optional marketing consent.
6. **Account & financial policy:** Sufficient customer support capacity, pre-activation cancellation/full refund, legally compliant records and retention, and account deletion handling are in place. Tax/legal/privacy publications and live checkout are separate approvals.
7. **No implicit sending:** Resend has three existing unpublished draft templates for purchase confirmation, delivery update and refund initiation. This activation invitation is a **fourth, distinct proposed message** and is **not** created in Resend by this document. Founder-only notification dispatch and all existing send/review gates remain disabled.

## Customer-facing editorial checks

- Clear distinction: **purchase recorded → app ready → invitation delivered → verified account claim → usable paid membership confirmed**.
- Do not imply that merely clicking, accepting beta terms, or receiving a receipt fulfills the pre-purchase.
- Do not promise an exact revised start date until a separately approved service calendar exists.
- Preserve the exact one-time/nonrecurring terms and refund rights in founder-approved customer Terms; this email must not attempt to alter that contract.
- Keep message concise and usable on mobile. No sales upsell, advanced-feature promise, forced marketing enrollment, or payment request.
- A future activated-membership confirmation email is **not** supplied here and must be separately drafted/reviewed if needed.

## Current approval and execution boundary

**Approved by founder:** only the high-level invitation-based activation approach.  
**Not approved:** the wording in this file, automatic activation, entitlement creation, claim URL, application auth changes, Resend template creation/publication/sending, legal Terms publication, Stripe writes, Cloudflare deployment, D1/Supabase migration, or customer checkout.

Source reviewed: `preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md` and `preorder/ACTIVATION_DELIVERY_APPROVED_APPROACH_2026-11-16.md`, plus existing three unpublished Resend template summaries and purchase-confirmation/delivery-update drafts retrieved read-only November 16. This is a *new* invitation proposal, not a repeat of existing purchase-confirmation or delivery-status messages.
