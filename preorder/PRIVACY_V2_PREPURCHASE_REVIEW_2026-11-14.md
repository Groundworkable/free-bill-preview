# Groundwork by Able — Privacy Policy pre-purchase changes for review

**DRAFT ONLY — November 14, 2026. NOT PUBLISHED OR EFFECTIVE.**

**Existing published source of truth:** `/privacy.html` — `privacy-v1`, effective October 3, 2026, covering the public site and invitation-only beta. The Company & Information view also displays that existing policy. Neither published location may be silently replaced or described as already covering real customer pre-purchases.

**Reason for review:** A proposed separate Stripe-hosted **one-time** pre-purchase of $9.99 or $96 for future standard application access. The current checkout is disabled, the isolated webhook is disabled, and no real orders have been processed. This is a policy drafting worksheet, **not an assertion that unfinished checkout processing is live**.

## Proposed additions to the existing privacy policy (legal and founder review required)

### Collection in the pre-purchase flow
If pre-purchases are activated, a customer uses a Stripe-hosted checkout page. Stripe collects the information needed to process payment, including card/payment-method and billing details. Groundwork's own proposed payment service should retain **only** limited purchase-related records, such as provider checkout session and payment identifiers, Stripe customer identifier where provided, purchased offer, accepted terms version, purchase status, currency, subtotal, tax and total, transaction timestamps, and verified refund/dispute event references and statuses. Do not imply a completed checkout activates a Groundwork account or paid membership.

The currently drafted isolated D1 order table does **not** itself contain a customer email address, application user ID or entitlement record. An accurate final policy must document the **actual** contact-to-order and fulfillment process once approved; do not claim customer email linking or automated receipts are already implemented.

### How purchase-related information would be used
Subject to implementation and disclosure, records would be used to verify provider-confirmed payment, deliver the purchased service when genuinely available, answer billing inquiries, honor refund/cancellation and delay remedies, reconcile disputes and taxes, detect fraud or unauthorized transactions, maintain security, and satisfy accounting and other lawful obligations. A one-time advance payment must never be described as authorization for automatic future charges.

### Payment and infrastructure providers
Add **Stripe** to the service-provider disclosures as the hosted checkout/payment processor and potential tax-calculation service. A separately isolated Cloudflare Worker and D1 storage environment is being tested for payment/order event records; **deployment, connected production processing, and actual retention behavior require verification before this language is published as current fact**. Keep previously disclosed provider relationships truthful and review whether any new provider or data transfer is involved in receipts, notifications or fulfillment.

### Support communications
Proposed payment/refund support contact: **billing@groundworkbyable.com**. General assistance: **support@groundworkbyable.com**. Both are mailbox aliases for the existing shared inbox; the founder reported that the billing alias test worked. Customer support case logging, identity verification, delivery of transactional notices and ongoing response capacity must be confirmed separately. Customers should never be asked to email full payment card numbers or CVC.

### Retention, security and choices
Keep purchase, accepted-terms, refund, dispute and relevant tax/financial records only as long as necessary for contractual, security and legal obligations. **Do not invent a numerical retention period** before provider configurations, applicable legal requirements, backups and deletion procedures are reviewed. Explain that some records may be retained despite account deletion where required by law or needed for valid claims. Preserve privacy request contact options, explain appropriate verification, and distinguish legally necessary transaction/service emails from optional marketing.

### Unchanged promises requiring verification
The existing policy says Able Systems does not sell personal information and identifies its existing analytics and other service providers. Do not expand or narrow those statements without examining actual processing. The public-site analytics description, financial planning data descriptions, age/region eligibility, account deletion and international processing applicability should receive separate review against the final product.

## Publication cross-check (all pending)

- [ ] Verify exact personal information Stripe returns and which fields the isolated Worker/D1 actually stores.
- [ ] Establish how payment records link to the purchaser's contact email and eventually to legitimate access claims, without unauthorized app integration.
- [ ] Confirm Stripe-hosted consent, final customer terms/version, refund policy URL and actual notices.
- [ ] Define record retention, customer privacy and refund support procedures with legal review.
- [ ] Review the existing published policy as a whole, including both `/privacy.html` and the embedded published-policy viewer in `/contact/`, so they do not show conflicting versions.
- [ ] Obtain founder and legal approval of a complete **new** effective Privacy Policy and its publication.
- [ ] Only then configure the separate payment launch gates, under distinct authorization.

**Safety:** Do not edit published `privacy-v1`, turn on Payment Links, set a fake Terms URL, deploy, merge PR #17 or change the Groundwork application through this draft.
