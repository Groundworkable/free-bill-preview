# Groundwork pre-purchase — connected-provider read-only recheck

**November 15, 2026 · Draft PR #17 · test mode and email-provider configuration only · NO-GO for activating purchases or sends**

This checkpoint supersedes older *state* claims in the November 13 payment-service README and November 15 handoff notes where those records have since changed. It is **not** an authorization to edit or activate a provider, Worker, application, or customer-facing website.

## Stripe — test-mode account read directly

The connected account available to this inspection was the existing Able Systems LLC **test-mode** Stripe account. No live-mode Stripe state was read or altered.

| Resource | Read-back findings | Release implication |
| --- | --- | --- |
| Monthly one-time test Payment Link ($9.99) | `active=false`, `consent_collection=null`, `automatic_tax.enabled=true` | INACTIVE; Stripe-hosted customer terms acceptance is not yet configured |
| Annual one-time test Payment Link ($96) | `active=false`, `consent_collection=null`, `automatic_tax.enabled=true` | INACTIVE; no automatic renewal and no active public offer |
| Isolated test webhook endpoint | `status=disabled`; eight subscribed checkout/refund/dispute events | INACTIVE; configured event types do not prove successful delivery |
| Stripe Tax settings | `status=active`; head-office information exists | Tax settings no longer blocked by missing head-office data; address omitted from this report |
| Stripe Tax registrations | **0 records**, `has_more=false` | No Stripe Tax collection jurisdiction currently configured |

**Tax safety:** Stripe Tax settings being active, and Payment Links having `automatic_tax.enabled=true`, **do not** imply tax is collected. Stripe Tax collects no tax in a state or country until a relevant registration is added. Confirm legal registration with the relevant taxing authority and applicability before adding anything in Stripe. Do not infer or manufacture a registration from a head-office address.

## Resend — connected email provider read directly

| Resource | Read-back findings | Release implication |
| --- | --- | --- |
| Groundwork sending domain | `verified`, sending enabled, receiving disabled | Email infrastructure is capable of sending; does **not** authorize customer sends |
| Purchase confirmation template | `draft` | Not published for transactional use |
| Delivery status template | `draft` | Not published |
| Refund initiated template | `draft` | Not published |

No customer email, test email, template publish, webhook change, domain change, billing transaction, or API write occurred. Domain sending availability must not be described as "Resend disabled" globally.

## Public website/checkout repository source (Draft PR #17)

The current `preorder/checkout-config.json` states `enabled=false`, `termsApproved=false`, `termsUrl=null`, `refundPolicyUrl=null`, and `paymentLink=null` for both offers. The selected prepay commercial schedule remains a **planning record**, not published or fulfilled sales terms. The January 1, 2027 product launch is a target, not an authorized charged delivery promise.

## Evidence limits / outstanding work

1. **Customer legal publication & hosted consent:** finalize/approve specific delivery, delay, refund, privacy and support copy; verify applicable legal requirements; configure Stripe-hosted consent before any purchase. Do not treat draft founder policy as published law or a usable customer contract.
2. **Tax/registration:** determine and document where the merchant is actually tax registered and obligated to collect, with appropriate professional/legal input; Stripe currently reports **zero** registrations. Do not add any based on assumptions.
3. **Isolated payment Worker:** current read-only smoke reports disabled `503`; no independently verified remote signed Stripe webhook → isolated D1 order exists. Keep the webhook and links disabled.
4. **Founder notification Worker:** active version UUID recorded in PR; pending authenticated version metadata/Access AUD match/wrong-account and recovery verification. The separate founder Worker remains guarded; notification code has only offline CI tests.
5. **Email:** provider domain verified, but all three reviewed templates remain unpublished and customer send workflow/consent/unsubscribe/support processes are unverified.
6. **Live mode:** **not inspected**. Never extrapolate the test account findings to a live Stripe account.

**GO:** source work, read-only account checks, offline CI, draft-only commercial/legal review.

**NO-GO:** activating Payment Links, webhook endpoint, Stripe Tax registrations without underlying legal authority, publishing templates, sending customer email, charging funds, deploying Workers, merging PR #17, or switching on public checkout.

No new recurring provider expense, account settings change, customer message, or payment was initiated by this recheck.
