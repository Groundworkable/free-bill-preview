# Groundwork by Able — Stripe TEST Payment Link Terms-consent preflight

**November 16, 2026 | Read-only verified provider inventory + documentation | NOT approval to mutate Stripe, publish Terms, conduct Checkout, or collect money**

## Reconciled result

- This project's connected Stripe account is **Able Systems LLC**, account `acct_1TwotnJK9stEim4w`, **TEST** (`livemode=false`). The test account was selected because it is the account already tied to the approved pre-purchase setup.
- **Both existing links exist, remain inactive and have no consent requirement**. The customer-facing price and terms are not active; no new Payment Link is needed merely to obtain an ID.
- The **current Stripe API reference for Update a payment link** lists **`consent_collection` as an optional update parameter**, and the connected Stripe OpenAPI operation `PostPaymentLinksPaymentLink` also explicitly accepts `consent_collection.terms_of_service` with values `none|required`. Thus the next *authorized* test should first attempt to update the **existing inactive TEST links** after Stripe's public business Terms URL is configured. **Do not recreate links or assert the update succeeded until the actual TEST response is checked.**
- Stripe's Payment Links documentation requires a **valid public Terms of Service URL in Stripe Dashboard → Public details** before requiring the checkbox. The approved Terms draft in GitHub is **not** published, and cannot serve as that URL. The business public details Terms URL has **not** been independently verified.
- An API documentation search answer claiming Terms consent is create-only conflicted with the up-to-date Update a payment link API schema and live provider operation schema. For any future separately authorized **TEST** change, follow and verify the API's actual returned object and a separately approved Checkout Session, not assumptions from a search snippet. If updates are rejected at runtime, stop and reassess: **do not automatically create new links, mutate live settings, or weaken consent**.

### Provider-read values — November 16, 2026, not invented defaults

| Field | Monthly pre-purchase | Annual pre-purchase |
| --- | --- | --- |
| Stripe Payment Link ID | `plink_1UbK33JK9stEim4w7BvY2CnM` | `plink_1UbK3MJK9stEim4w2nS3loNW` |
| `livemode` | `false` | `false` |
| `active` | `false` | `false` |
| `consent_collection` | `null` | `null` |
| `automatic_tax.enabled` | `true` | `true` |
| `billing_address_collection` | `required` | `required` |
| `customer_creation` | `always` | `always` |
| `after_completion.type` | `hosted_confirmation` | `hosted_confirmation` |
| `after_completion.hosted_confirmation.custom_message` | Test payment; no paid membership activated | Test payment; no paid membership activated |
| `metadata.environment` | `test` | `test` |
| `metadata.auto_renewal` | `no` | `no` |
| `metadata.fulfillment` | `not_activated` | `not_activated` |

The previously verified one-time prices remain $9.99/monthly pre-purchase (999 cents) and $96/annual pre-purchase (9600 cents), with **no recurring price**. Both offers retain the founder-approved January paid / February complimentary on-time schedule; **delayed/mid-month dates remain UNAPPROVED**.

## Only after separate legal publication and TEST-write authorization

**Preparation, not a procedure authorized to execute now:**

1. Finalize legal/regional review and actual fulfillment/support/calendar, secure customer-purchase verification and refund operations. Obtain separate founder approval of exact Privacy V2/Terms publication with real effective date, true `TERMS_VERSION` and stable public HTTPS URLs. Customer wording approval from November 14 was **not** legal or publication clearance.
2. Only after public documents are published and validated at their actual HTTPS URLs, configure/verify the **real** public Terms URL in Stripe's **Public details**; set an appropriate Privacy URL separately as applicable. No guessed or private placeholder URL.
3. Obtain a separate, narrow approval for a **Stripe TEST ONLY** Payment Link consent update. Use the existing link IDs above; send the minimal update parameter `consent_collection: { terms_of_service: 'required' }`, with `active: false` maintained. Do not send any additional parameters that could change price, tax, payment method, completion behavior, email, trial, metadata, or legal promises.
4. Immediately **GET** each TEST Payment Link again and independently confirm **all of**: still inactive, still test mode, `consent_collection.terms_of_service = required`, same monthly/annual one-time price/line item, automatic tax and billing address settings unchanged, no auto renewal, and same no-activation message. Rejection or missing fields means STOP, not permission to create an alternative.
5. After separate, explicit approval for a **single real Stripe TEST Checkout** (never LIVE), verify the hosted checkbox is displayed and accepted, and that a verified test Checkout Session returns `consent.terms_of_service = accepted`, and the isolated receiver's published `TERMS_VERSION` exactly matches the version accepted by that purchaser. No synthetic user-facing consent assertion is sufficient.
6. Only later, under separate authority: webhook/notification reconciliation, customer account claim, approved entitlement calendar, full refund and failure-path tests. The purchase confirmation, delivery and refund templates remain **unpublished** in Resend; activation invitation is **GitHub review copy only**. No production email sending or membership activation is authorized.
7. **Real customer charging is an entirely separate release gate**. The founder **already submitted the SC Retail License application and paid its $50 fee November 13**; **do not reapply or repay**. The actual license approval/effective date, tax registration, classification, interstate nexus and any local licensing are still to be verified before live taxable sales.

## Immutable fail-closed boundary on this review

Current GitHub `preorder/checkout-config.json` remains `enabled=false`, `termsApproved=false`, `termsUrl=null`, `refundPolicyUrl=null`, and **both `paymentLink` values null**. Existing Stripe TEST Payment Links remain `active=false`. Neither the existence of a passed CI bundle nor this document authorizes opening checkout.

### Source evidence

- Connected Stripe account inventory (read-only), November 16, 2026: `list_available_accounts_or_orgs`, `GetPaymentLinksPaymentLink` GET for the two exact TEST links, and the `PostPaymentLinksPaymentLink` **parameter schema only** (no execution).
- Stripe [Update a payment link](https://docs.stripe.com/api/payment-link/update), optional `consent_collection` update parameter.
- Stripe [Customize Payment Links — collect agreement to Terms of Service](https://docs.stripe.com/payment-links/customize#collect-agreement-to-your-terms-of-service), requires public business Terms URL and `consent_collection.terms_of_service=required`.
- Founder-approved but unpublished `preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md`, `preorder/LEGAL_PUBLICATION_HANDOFF_2026-11-14.md`, `preorder/ACTIVATION_DELIVERY_APPROVED_APPROACH_2026-11-16.md`, and latest payment handoff.
