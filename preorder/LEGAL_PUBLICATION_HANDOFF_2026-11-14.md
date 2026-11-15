# Groundwork pre-purchase — legal publication handoff (no deployment)

**STATUS: STAGED FOR LEGAL/OPERATIONAL REVIEW ONLY. NOT A LIVE POLICY, CHECKOUT AUTHORIZATION, OR LAUNCH ORDER.**

## Already approved by founder

- Customer-facing pre-purchase terms wording: `preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md`
- Privacy Policy V2 candidate wording: `preorder/PRIVACY_POLICY_V2_COMPLETE_CANDIDATE_2026-11-14.md`
- Commercial calendar and voluntary/late-delivery refund structure already fixed in the approved founder policy.

These approvals concern customer-facing **wording and terms**, not final legal clearance, publication, payment acceptance, or technical fulfillment.

## Source and destination map

| Current published surface | Current status | Authorized publication action when cleared |
| --- | --- | --- |
| `privacy.html` | `privacy-v1`, effective 2026-10-03 | Replace its policy body with finalized `privacy-v2`, supply the true publication effective date, retain site navigation and legal styling |
| `contact/index.html` embedded `gwPolicyDialog` | Transcript of `privacy-v1` | On **the same release**, replace the entire embedded policy body from exactly the same approved source as `privacy.html`; update modal/source status, version and date indicators |
| Company & Information legal status text in `contact/index.html` | Advertises published `privacy-v1` | Update its trust labels, copy, links and dates consistently if publication is authorized |
| New stable HTTPS pre-purchase Terms of Service page | Not yet published | Publish **only** legally reviewed customer copy from the approved terms, excluding all internal release notes; assign an approved immutable terms version |
| Stripe account business/public settings | No verified public Terms URL | Set the actual accessible Terms URL only **after** the page exists and is approved; verify both existing disabled test Payment Links |
| `preorder/checkout-config.json` | Fail-closed: `enabled=false`, `termsApproved=false`, no URLs/payment links | Remain unchanged until a **separate explicit payment launch** approval; publication alone does not open checkout |

## Consistency checks now in CI

`scripts/preorder_legal_release_gate.py` asserts both published privacy views carry matching customer-facing policy text (whitespace normalized) and still show the current `privacy-v1` metadata. It also verifies the founder-approved privacy-v2 review artifact, terms review and the independent disabled checkout configuration. This intentional guard must be **replaced** with a reviewed v2-release verification test in the same authorized publication PR; it must not be bypassed or removed merely to pass a deployment.

## Outstanding publication and sandbox gates

1. Counsel/legal review of the terms and full Privacy Policy V2 including consumer rights, appropriate refund timing, eligibility, provider disclosures and applicable SC/U.S. obligations.
2. Verify actual Google Analytics/privacy practices, purchaser contact-to-Stripe-order matching, outgoing purchase/refund/delay notices, refunds and retention process. The isolated D1 schema has no customer email or app entitlement.
3. Confirm South Carolina Retail License issuance or applicability and Stripe Tax registrations/collection obligations. Stripe Tax sandbox status `active` is **not** registration evidence.
4. Assign final effective date and Terms version **at publication** and confirm both public policy locations and support channels work.
5. After publication, configure Stripe-hosted acceptance on existing test Payment Links and conduct a separately authorized, time-limited test-only transaction/refund. Before that, links and webhook remain inactive, payment Worker `PAYMENTS_MODE=disabled`, `TERMS_APPROVED=false`, `TERMS_VERSION=UNAPPROVED`.
6. Independently verify the deployed isolated Worker version and signed callback-to-remote-D1 behavior. Existing remote fail-closed smoke check does not establish either.

**No new recurring subscriptions, payment activation, consumer-facing deployment, or production Groundwork app changes are part of this handoff.**
