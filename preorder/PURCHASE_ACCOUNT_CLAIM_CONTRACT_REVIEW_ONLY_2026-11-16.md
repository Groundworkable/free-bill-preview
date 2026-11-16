# Groundwork — Verified Pre-purchase → Account Claim → Paid Access

**Review-only architectural contract.** November 16, 2026. **No app implementation, Supabase DDL, payment activation, email sending or legal publication authorized.**

## Authority and evidence

- **Founder-approved UX:** verified pre-purchasers receive an invitation to **sign in or create a Groundwork account**. Purchased access is applied **only after the paid application is independently verified usable**. See `ACTIVATION_DELIVERY_APPROVED_APPROACH_2026-11-16.md`.
- **Source inspected:** `Groundworkable/groundwork-life` main commit `52001fad919b91e1b7fdbf28d228f96ec8523f37`; `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/integrations/supabase/auth-middleware.ts`, `src/lib/groundwork/customer-access-middleware.ts`, `src/lib/groundwork/legal.ts`, `src/integrations/supabase/types.ts`, `src/lib/groundwork/accountDeletionFinalize.server.ts` and selected `supabase/migrations`. This source supports email/password Supabase Auth, optional Google Auth, MFA, private-beta invitation/acceptance, account deletion; it does **not** establish an existing paid subscription/entitlement or verified Stripe order claim.
- **Payment state inspected:** `free-bill-preview` Draft PR #17 stores a Stripe-verified one-time checkout in isolated D1 as `paid_unfulfilled`; it does **not** grant access, hold an application user ID, or retain buyer email in the order table. Read-only founder notification status has been demonstrated. Simulated native Workerd/D1 pipeline passed GitHub Actions run 43846065473. Real Stripe TEST purchase has not occurred.
- **Deployment uncertainty:** GitHub app code is *not evidence* of the deployed app revision. Connected Supabase `get_project` metadata identifies `Groundwork Production` plus two validation projects as `INACTIVE` on Nov 16. This does **not** establish which Supabase organization/project the active site uses; it may use another Lovable Cloud backend. GitHub connected operations cannot query the live app's deployment commit, and public website retrieval did not succeed. Do not modify/resume any project on this evidence.

## Proposed four-system contract (not implemented)

| Source | Authoritative for | Not authoritative for |
| --- | --- | --- |
| Stripe TEST (later live, separately authorized) | Financial facts: checkout, paid/refunded status, amount, tax, terms consent | Groundwork account identity or paid feature availability |
| Isolated payment D1 | Immutable checkout verification, `paid_unfulfilled`, review/audit and payment reconciliation | Supabase `auth.users`, paid tier, invitation redemption |
| Trusted claim-and-entitlement backend (future) | One-time claim proof, mapping from provider-verified order to authenticated app user, entitlement issuance/revocation history | Self-asserted purchaser email, client-reported payment success |
| Supabase Groundwork app (existing auth) | Authenticated identity, MFA/session assurance, product availability and eventual membership feature gates | Determining payment success from a link/referrer/customer-supplied ID |

**Boundary:** No client-supplied email, Stripe session ID, public link fragment or editable `user_metadata` can authorize purchase ownership, access status or entitlement updates. Any private backend-to-backend attestation must be authenticated, narrowly scoped, short-lived, replay-protected and must not expose Stripe secrets/Supabase service-role keys to the browser. Choose concrete service/API/database only after verifying the live deployment and service ownership. Account creation is not proof of paid status.

## Proposed state machine (future design, not a live schema)

```text
PAYMENT (isolated D1)
  awaiting_provider_verification
          |
          +-- verified one-time paid + consent -> paid_unfulfilled
                                                   |
                                                   +-- refund/cancel/dispute -> refund_or_dispute_review
                                                   |
PURCHASER CLAIM                                      +-- (no automatic activation)
  not_issued -> issued -> verified -> bound_to_user
                     |          \-> manual_identity_review
                     +-> expired/revoked
                     +-> reissued (previous token invalidated)
  Every verified purchase binds at most once unless explicit audited manual remedy.

PRODUCT ENTITLEMENT
  none -> awaiting_app_readiness -> eligible_to_activate -> active -> expired
                     |                        |
                     +-> delayed/refund        +-> refund/dispute/revoked
  No 'active' solely from purchase, sign-in, receipt, invitation, claim or calendar date.
```

### Proposed minimal sensitive data (subject to privacy/legal approval)

- **Payment side:** existing trusted Stripe Checkout Session/PaymentIntent/Price/terms version/amount/currency and D1 `paid_unfulfilled`; keep existing immutable evidence.
- **Claim side (private server storage, exact location TBD):** internal `claim_id`, hashed one-use token or nonce, reference to *verified* purchase (prefer opaque service-scoped ID), issue/expiry/consumption timestamps, state, retry/revocation metadata and minimal necessary purchaser-contact verification evidence. **Never persist raw claim token**; never put secrets in analytics, access logs or durable browser storage.
- **User binding:** verified Supabase Auth UUID, linked purchase reference, unique server-enforced constraint; no browser write to binding; access governed by RLS/denied roles and privileged backend operations with explicit authorization.
- **Entitlement:** plan/offer ID (monthly vs annual), actual usable service-start evidence, purchased months and complimentary month, paid-through date, availability gate, purchase claim and refund/dispute status, version/audit; do not use `profiles.created_at` as paid start.
- **Account deletion:** maintain only lawfully necessary financial/refund and audit records, dissociated/deleted according to approved privacy/retention policy. Avoid silently cascading required purchase evidence when Auth user is hard-deleted.

## Proposed claim/activation operations (names illustrative only)

1. `prepare_invitation_for_verified_order` (restricted service): independently read provider-confirmed, nonrefunded, one-time order and recipient verification source. Require launch-ready cohort and approved transactional communications. Issue short-lived single-use invite; do not activate.
2. `redeem_purchase_claim` (authenticated app user + proof of the invitation): fresh, verified Supabase identity; check target buyer-control evidence, token expiry/replay/recipient conflict, provider/payment/refund state and one-purchase-to-one-user binding. Atomic claim; return no secrets or sensitive payment details. If account or purchase identity differs, return manual review rather than guessing.
3. `activate_verified_entitlement` (restricted backend): assert independently verified app paid-feature readiness, claimed order ownership, terms/fulfillment, refund/dispute state, approved plan/version and correct calendar; write one immutable activation event with **actual usable access start** (not invitation send or creation of account) and computed service coverage. Transactional idempotency, no active membership on a partial failure.
4. `reconcile_order_change` (restricted backend): on authenticated Stripe refund/dispute and independently verified provider events, reconcile future/current access and records while retaining original payment evidence; no new recurring charge.
5. `show_my_purchase_access` (authenticated, owner-scoped read): show purchase awaiting access, active paid term, complimentary time, service-through date, accurate support/refund status; suppress provider secrets, another buyer's order, claims and contact data.

None of these operations exists yet. They are **contracts to review**, not authorization to add a route, database table, credential or RPC.

## Hard invariants to turn into tests before any build

- `paid_unfulfilled` can exist without any Groundwork user; `private_beta_acceptances` or existing beta invitation alone cannot redeem it.
- One verified purchase can map to **at most one** app user and one approved purchased entitlement, even under simultaneous requests, retries and duplicated Stripe events.
- Authenticated user A cannot use user B's order ID or forwarded link; if buyer-contact and user identity are ambiguous, **manual review**, never automatic reassignment.
- No Supabase client/RLS path lets the user insert/update `paid_through`, `plan`, `purchase_id` or activation timestamps.
- Date/time clock starts only after independent usability and accurate buyer confirmation; a bounced or unclaimed invitation never consumes purchased time.
- Monthly advance: one purchased month + conditional complimentary February 2027 under the already-approved schedule; annual advance: full **12 purchased months** plus additional complimentary February 2027. Preserve all time if delivery starts late; mid-month/date rules need an approved deterministic engine.
- Refund initiated before usable paid start, Stripe disputes and account deletion do not leave silently active or transferable entitlements. Customer support must be able to reconcile without exposing unrelated user financial data.
- `Groundwork Lite`, free Founding Access reservations, organizational sponsorships, Advanced/Marketplace and general beta are separate products; no cross-tier or recurring payment leakage.

## Release gates and test order

1. **Confirm actual live app version / backend identity:** app host deployment evidence, deployed commit/build, Auth issuer/project ref and signed API base URL **without disclosing API keys/tokens**. Verify the reported inactive `Groundwork Production` project is actually or not actually related. This is **unresolved**.
2. **Approve design of trusted account-linking and identity challenges** with legal/privacy/retention and account deletion treatment, then implement separately in an isolated branch only after explicit founder implementation authority.
3. **Test claim state and RLS** locally/sandbox including duplicate, replay, forwarded link, wrong address, lost invite, deleted user, OAuth-email change and refund/dispute paths before connecting to live app.
4. **Test usable-service calendar and zero early entitlements** for preview, on-time, delayed and mid-month cases with the exact original paid months and free February.
5. **Only after legal publication and Stripe hosted-consent signoff**, execute a separately scoped genuine Stripe TEST-mode payment to verify payment→claim→entitlement end to end. Resend dispatch and public checkout stay disabled until separate release.

## Current stop condition

**No production deployment modification and no provider write was made** to produce this document. The next meaningful task is **read-only confirmation of the actual deployed app revision and Auth backend**. Do **not** re-run Cloudflare/D1 migrations, historical founder status checks, or the now-passed native Workerd CI just to progress this contract.
