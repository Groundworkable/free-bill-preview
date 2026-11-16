# Groundwork by Able — South Carolina SaaS pre-purchase sales tax and retail license readiness

**Date reviewed:** November 16, 2026  
**Status:** RESEARCH AND RELEASE-BLOCKER ANALYSIS ONLY — NOT LEGAL OR TAX ADVICE, NOT LICENSE VERIFICATION, NOT AUTHORIZATION TO APPLY OR TAKE PAYMENT  
**Product scope:** Able Systems LLC's one-time, **nonrecurring** standard individual Groundwork access pre-purchases: one purchased month for $9.99; twelve purchased months for $96; January 1, 2027 opening target; February 2027 additional complimentary month under the approved on-time calendar; conditional preview; full pre-activation refunds.

## Finding and release posture

**Do not enable live/pre-purchase checkout on the theory that online hosted software is automatically exempt from South Carolina sales tax.** The South Carolina Department of Revenue (SCDOR) explicitly lists **cloud-based services** and **database access transmission** as taxable communications services, and its Revenue Ruling #03-5 discusses customer access to an Application Service Provider (ASP) website to use hosted software as subject to sales/use tax. The particular Groundwork offers and timing of prepaid but not-yet-available access still require a product-specific determination; the ruling does not authorize assuming every software-related feature or every interstate sale is taxed in precisely the same way.

### Verified official guidance (current SCDOR website; citations with full URLs)

| Question | Official guidance and its limits | Groundwork release implication |
| --- | --- | --- |
| Are hosted software / cloud services potentially taxable? | [SCDOR — Sales Tax](https://dor.sc.gov/sales-use-tax-index/sales-tax) lists cloud-based services, database access and communications among taxable services. [SCDOR Revenue Ruling #03-5 — Software](https://www.dor.sc.gov/sales-use-tax-software), ASP discussion and Q15, states hosted software-use fees may be taxable communications; this is an agency advisory opinion, not a binding determination of these exact offers. | Treat Groundwork standard **paid SaaS access as materially likely taxable in SC** unless specific professional/SCDOR clarification determines otherwise. Do not reclassify it as nontaxable merely because payment is one-time or access begins in the future. |
| Retail License required? | [SCDOR — Licensing (Retail License)](https://www.dor.sc.gov/businesses/apply-business-tax-account/licensing-retail-license): a business making **taxable retail sales in SC, including internet or infrequent sales**, needs a Retail License **before** those sales; fee is **$50 nonrefundable** per location. Licenses don't require annual renewal while the same retailer remains at the registered location; updates required for location changes. | **Confirm whether Able Systems LLC already has an issued retail license.** No issuance was proven by the payment integration evidence. If required and not issued, obtain it before live taxable charges, only with founder authorization. |
| Filing obligations? | [SCDOR — Sales Tax](https://dor.sc.gov/sales-use-tax-index/sales-tax) lists normal monthly returns due on the **20th of the following month**, subject to weekend/holiday adjustments; quarterly/annual filing requires separate SCDOR approval. [SC Business One Stop — Retail License](https://scbos.sc.gov/business-compliance/licenses/retail-license) says registered sellers must file even for periods with **zero sales**. | Do not treat $50 as the only operational burden. Plan returns, remittances, refund adjustments and possible zero-sales filings; request alternate filing frequency if appropriate/approved. |
| Tax rates? | [SCDOR — Sales Tax](https://dor.sc.gov/sales-use-tax-index/sales-tax) gives statewide **6%**, plus locally applicable taxes; [SCDOR — Local Sales Taxes](https://dor.sc.gov/sales-use-tax-index/local-sales-taxes) confirms local variation. | **Do not hardcode 6%, 9%, or seller's residence rate for all customers.** Verify customer-jurisdiction sourcing and product taxability in checkout with a registered tax setup. |
| Is an SC Retail License the only business permission? | [SCDOR — Retail License](https://www.dor.sc.gov/businesses/apply-business-tax-account/licensing-retail-license) expressly distinguishes the state Retail License from **local county/municipality business licenses**. | Verify any separate local licensing based on the actual business location before public trading. |
| How to apply / processing? | [SCDOR — Apply for a Business Tax Account](https://www.dor.sc.gov/businesses/apply-business-tax-account): MyDORWAY application; business entity details, FEIN, physical/mailing address, officers, NAICS and email; states **up to 5 business days** for application processing. | Do not spend money or initiate an application without explicit founder approval. Allow for processing; no approval/issuance is inferred from a DUNS number or LLC registration. |
| Are out-of-state buyer sales automatically subject to SC rates? | [SCDOR — Remote Sellers](https://dor.sc.gov/sales-use-tax-index/sales-tax/remote-sellers) describes a **$100,000** economic-nexus threshold for **out-of-state businesses**, distinct from an in-state retailer's own obligations. | That threshold **does not exempt a South Carolina seller from its own home-state licensing requirements**. Analyze buyer-state nexus/registration obligations separately; SC guidance does not decide other states' law. |

### How this aligns with the existing Stripe configuration

This section is a **historical read-only snapshot**, not a fresh Stripe API verification or license check:

- The connected **Stripe TEST** account was previously verified to have Stripe Tax settings marked *active* and the two **inactive**, one-time TEST Payment Links set to `automatic_tax.enabled=true`.
- As of the prior November 16 Stripe TEST inventory, **zero Stripe Tax registrations** were present; no Checkout Sessions or PaymentIntents had been created.
- The $9.99/$96 test prices are one-time, exclusive of any applicable taxes, and use a software/SaaS-related product tax code. **Active tax calculation settings do not prove that SCDOR issued a state Retail License or that Stripe is collecting state tax**. An empty tax amount is not proof a sale is exempt.
- [Stripe Payment Link API documentation](https://docs.stripe.com/api/payment-link/object) explains that automatically calculated tax depends on customer location and tax registration; [Stripe API taxability reasons](https://docs.stripe.com/api/invoice-line-item/object) include `not_collecting` when the seller lacks registration. Do not register a state with Stripe unless the actual legal tax registration is in place and authorized.

### Product-specific questions that are NOT resolved by these sources

1. **SC classification**: Is the exact Groundwork product (hosted personal financial planning software with customer-entered financial data and optional calculations) taxable as ASP/cloud access for all of the proposed offers? What if any elements qualify for separate data-processing treatment? Avoid assuming non-taxable classification because customers manipulate their own data.
2. **Timing of advance consideration**: If the seller collects a *one-time, refundable pre-purchase now* for software access targeted for January 2027, when does the sales-tax liability arise: upon charge/receipt, future delivery, or another event? What if refunded before use, delayed, or later cancelled?
3. **Sourcing/local tax**: Which buyer address or use location governs the applicable SC county/municipality tax for access to hosted software? Must billing address, location of primary use, or another relevant fact be collected?
4. **Free time and discounts**: How should conditional December preview and February's additional complimentary month be represented when determining taxable proceeds? Does the one-time prepayment cover only paid access with the gift month separately valued at zero for sales-tax purposes?
5. **Refund accounting**: What is required for reporting/refunding tax collected on fully or partially refunded SaaS pre-purchases, including the policy of $8 per wholly unused future paid annual month?
6. **Interstate sales**: Which buyer states need registration before sales based on nexus or other applicable statutes? Do not use the SC seller's rate for buyers elsewhere.
7. **License and filing**: Does the company's current registration include an *issued SCDOR Retail License* and Sales & Use account? Determine any local licensing and filing frequency.
8. **Stripe Tax sequencing**: After actual tax registrations are confirmed, explicitly configure matching Stripe Tax jurisdictions; test with location-specific synthetic addresses, consent checkbox and no automatic recurring charge before any separately authorized real payment.

## Ready-to-send inquiry for SCDOR (DRAFT ONLY; DO NOT SEND WITHOUT USER ACTION)

**Proposed subject:** Classification, Retail License and sales-tax timing for prepaid hosted-software access

To the South Carolina Department of Revenue:

Our South Carolina LLC is preparing to sell one-time advance purchases of access to an online, hosted personal planning software service. Customers would use the application through our website, enter and analyze their own financial and planning information, and receive no downloaded software or physical product.

The proposed offers are $9.99 for one future paid month or $96 for twelve future paid months; each is one payment only, with no automatic renewal. Access is currently targeted for January 1, 2027, with an additional complimentary month and a possible earlier free preview only if the application is ready. Customers can request full refunds before their usable paid service starts, and there are refund/delay rights.

Before accepting any funds, could you confirm:

1. Whether this hosted application access is taxable under the Department's ASP/cloud-services guidance, and whether any different treatment of customer data-processing features is relevant.
2. Whether a state Retail License and Sales & Use Tax account are required before taking refundable **prepayments**, and when tax would accrue if actual access starts later.
3. Which customer location/address determines SC local sales tax, and how to report fully or partially refunded advance purchases.
4. Whether complimentary access affects the tax base, and the appropriate return filing frequency including months with no taxable sales.

We are preparing to use Stripe for hosted one-time checkout but have not enabled sales. We would appreciate any specific written guidance, ruling references, or next steps.

Thank you.

**Official contacts:** RegistrationforTaxes@dor.sc.gov (registration); SalesTax@dor.sc.gov (tax classification / return questions). Do not email personal account numbers or sensitive credentials in an initial inquiry.

## Recommended precise release gate

- **SC tax classification and prepayment timing:** PENDING specific SCDOR or qualified SC tax-adviser guidance.
- **SC Retail License:** **NOT VERIFIED ISSUED**. If required, founder authorizes one-time $50 application and receives license before actual taxable pre-sales.
- **Buyer-state and local nexus:** PENDING jurisdictional review; no universal buyer-rate assumption.
- **Stripe Tax registrations / test consent:** TEST SNAPSHOT HAD ZERO REGISTRATIONS; no changes permitted until valid registration, founder approval and correct product treatment.
- **Public legal Terms and privacy publication:** PENDING review and explicit separate release; Stripe hosted terms consent currently cannot be relied upon.
- **Stripe TEST genuine checkout, real live checkout and notification sending:** remain **DISABLED / UNAUTHORIZED**.

**No mutations from this research:** no license application, state fee, tax registration, Stripe account configuration, Cloudflare/D1/Supabase change, Resend email, legal publication, storefront or charge. This document is source-backed preparation to enable a better informed founder decision later, not a declaration that the project is legally ready to sell.
