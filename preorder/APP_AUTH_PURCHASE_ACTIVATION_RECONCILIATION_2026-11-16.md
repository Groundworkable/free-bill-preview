# Groundwork by Able — Existing App Auth vs. Approved Pre-purchase Activation

> **Deployment-source correction, November 16, 2026 (supersedes prior deployment uncertainty below):** The founder had already attested that the authenticated Groundwork application at `app.groundworkbyable.online` is deployed as Cloudflare Worker **`groundworkable-groundwork-life`**, built by **ChatGPT and Codex**, not Lovable. The last founder-attested 100%-traffic version was `7b457b20-770c-47c1-9558-3bb3253f362c`, with release merge commit `6f6868e6dae45f44848684eab5f20c4b7b4882e4` on GitHub `Groundworkable/groundwork-life` branch `codex/micah-production-import` (PR #36 merged October 23). This is **historical deployment evidence, not a fresh Cloudflare API query of the current version**.
>
> GitHub read-back **at the last attested release commit** independently confirms `wrangler.json` names the same Worker, custom domain and production runtime `SUPABASE_URL=https://vmoerivhazwyddsnnqxj.supabase.co`. Its original production deployment report `docs/ai/v1.1-production-deployment.md` confirms Cloudflare/Workers + this account's production runtime bindings; the earlier October release described there is historical, not a current version. The older `supabase/config.toml` ref `xekbgfotzzsgnortditd` is a **local/historical identifier**, not evidence of the live backend. Re-read the Auth files at `codex/micah-production-import` as well as main; the authenticated route and generated types inspected are unchanged in substance, while `auth.tsx` has additional work and still lacks Stripe entitlement redemption. **Do not ask the founder to connect Lovable, migrate infrastructure or repeat already completed deployment tests.** The next relevant step is secure claim and entitlement integration design against this source, then separate founder authorization before any implementation.


**Date:** November 16, 2026  
**Status:** SOURCE-BASED ARCHITECTURAL RECONCILIATION ONLY — NOT APP IMPLEMENTATION OR RELEASE AUTHORITY  
**Approved direction:** verified purchaser receives an email invitation to sign in or create an account; purchased membership begins only when usable paid access is verified available. Approval recorded in `preorder/ACTIVATION_DELIVERY_APPROVED_APPROACH_2026-11-16.md`. No need to re-ask the founder to approve this direction.

## Source baseline, not a production deployment claim

Inspected GitHub sources at `Groundworkable/groundwork-life` `main` **52001fad919b91e1b7fdbf28d228f96ec8523f37**; cross-checked the open draft app-release branch `release/founder-admin-v1` for the relevant Auth/route/types files; the inspected blobs were identical. The actual application deployed at `app.groundworkbyable.online` and its currently configured runtime Supabase project were **not independently inspected**; do not infer they match this source version or a particular published release. The connected Supabase project list currently shows three projects (`Groundwork Production`, `groundwork-p1b-sql-sandbox`, `groundwork-held-money-final-validation`) all marked **INACTIVE**; this does **not** independently establish which provider/project the deployed Lovable Cloud app uses. No project was activated, queried for personal information, or modified.

### Evidence from actual source

| Component / inspected file | Verified existing behavior | Activation implication |
|---|---|---|
| `src/routes/auth.tsx` | Supabase email/password `signUp` / `signInWithPassword`, conditional Google OAuth, recovery; `PRIVATE_BETA_INVITATION_ONLY=true`; existing `/auth?mode=invite` gets Supabase session, records beta legal acceptance via `accept_groundwork_private_beta_terms`, then sets password | Existing invite flow is for **private beta Auth onboarding**, not redemption of one-time paid Stripe orders. No purchase token is verified there. Do not silently reuse `?mode=invite` as a paid entitlement claim |
| `src/routes/_authenticated/route.tsx` | `supabase.auth.getUser()`, MFA assurance check, and beta terms acceptance check gate authenticated pages | Authenticated membership/paid tier is **not** checked by this route. Access to beta must remain distinct from paid access |
| `src/integrations/supabase/auth-middleware.ts`; `src/lib/groundwork/customer-access-middleware.ts` | Server function receives bearer token, validates Supabase claims and asserts Groundwork customer access via DB RPC | Future claim and entitlement operations should use verified server-side identity and authorization, **not** client-supplied email/IDs as authority |
| `supabase/migrations/20260815095945_0b58793e-ba56-460c-914c-8bce973035b9.sql` | `public.profiles.id` references `auth.users(id)` with owner-only RLS; new user trigger creates a profile | A Supabase Auth user UUID is the natural **existing app account identity**; profile creation is not proof of a purchase or of a paid membership |
| `supabase/migrations/20261003225712_private_beta_acceptances.sql`; `src/lib/groundwork/legal.ts` | Own-record append-only `private_beta_acceptances` for `private-beta-v1` and `privacy-v1`; `effectiveAt` explicitly flagged not final for production app | **Do not conflate** account/private-beta terms acceptance with Stripe's legally versioned pre-purchase acceptance; existing beta version is not approved pre-purchase Terms |
| `src/integrations/supabase/types.ts` / `supabase/migrations/*` / `src/components/groundwork/Shell.tsx` | Inspected the generated Supabase table types, migration file names, navigation and authenticated route. No defined `membership_entitlements`, `customer_purchases`, `prepurchase_claims` or Stripe subscription/membership table/paid-feature access check was found in these inspected sources | Existing app-authenticated access is **not** an implemented one-time pre-purchase entitlement/claim system; actual running deployment and other draft work must still be checked before implementing |
| `src/routes/_authenticated/settings.tsx` | “Member since” is based on `profile.created_at` | Existing display **does not establish a paid membership start date** |
| `supabase/migrations/20260922112000_groundwork_notifications_and_updates.sql` | `notification_preferences.product_update_email_enabled` is optional marketing/product update preference; required service/security communications are separate | Transactional purchase/activation notices must be modeled separately from optional marketing opt-ins |
| `src/lib/groundwork/accountDeletionFinalize.server.ts` | Revokes Plaid, deletes customer records, then hard-deletes the Supabase Auth user | Paid-purchase/refund/audit obligations and post-deletion support cannot rely solely on a cascading live `auth.users` reference; define legal retention/data-minimization rules before adding identity link |

## Existing isolated payment service — verified separation

`Groundworkable/free-bill-preview` Draft PR #17:

- The isolated Stripe TEST webhook receiver stores independently verified, one-time, `paid_unfulfilled` orders in `prepurchase_orders`, using Stripe Checkout Session / PaymentIntent / Payment Link / Price identifiers. No recipient email, app-user ID, account membership, recurring billing or customer entitlement is stored in that D1 purchase table.
- Pending-only founder test notification is opt-in, uses HMAC recipient fingerprint, no plaintext email in D1, and does **not** authorize review, sending or access. A live authenticated founder read-only status query previously passed; notification review/dispatch remain disabled.
- Native **synthetic** Workerd/D1 CI run 43846065473 passed, but no real Stripe TEST Checkout Session exists yet and the isolated payment Worker is not activated for public checkout.
- Customer pre-purchase Terms version is still `UNAPPROVED`/unpublished; the ordinary Groundwork beta Terms are a separate legal agreement.

## Recommended future contract — SPECIFICATION, NOT AUTHORIZED CODE

Keep **four identities/states separate**:

1. **Stripe purchase identity**: immutable verified provider order + terms acceptance + financial/refund/dispute evidence, maintained in the isolated payment service.
2. **Verified purchaser claimant**: one-time claim capability created by a trusted backend *after* purchaser/contact verification; never infer authority solely from equal email, user-supplied Checkout Session ID, browser redirect or a forwarded invitation.
3. **Supabase app user identity**: validated user UUID from the authenticated Groundwork session with necessary MFA/session freshness, linked only through a separately authorized, replay-protected claim operation.
4. **Paid access entitlement**: independent, auditable owner/plan/service-period record issued only when the app's purchased paid functionality is verified usable and all legal/refund/release gates pass. This must not replace the `paid_unfulfilled` payment ledger or silently make an automatic subscription.

### Proposed flow and invariant

```text
Independently verified Stripe TEST payment
      ↓
Isolated purchase: paid_unfulfilled
      ↓ [no activation]
Truthful purchase confirmation (once transactional mail authorized)
      ↓ [release-readiness + verification gate]
Single-use account invitation, delivered transactionally (once authorized)
      ↓
Existing Supabase sign-in OR new-account onboarding
      ↓
Server-side, one-time verified purchaser → app-user claim
      ↓ [app usable + claim valid + financial status + cohort calendar]
Paid membership entitlement with actual usable-start evidence
      ↓
Customer sees accurate paid/unpaid/free periods and support/refund path
```

The email invitation is **an entry point, not a credential that automatically grants paid membership**. Existing `/auth?mode=invite` remains the private-beta legal/password path until a deliberate app-auth integration design is approved. Avoid open public signup as an accidental side effect of accepting the high-level activation approach.

### Required independent implementation design decisions (not yet resolved)

- **Backend trust boundary:** identity-proofed, short-lived, single-use claim bound to verified paid order; store only a suitably hashed claim secret and minimum identifiers with no secrets in URLs logged/analysed. A separate trusted service may be necessary; never place Stripe API keys or Supabase service role in frontend.
- **Auth and RLS:** use verified `auth.uid()` and a narrowly authorized server-side claim; do not trust user metadata, email equality, `auth.jwt()` role alone or client-created records. Define owner-only, deny-by-default access; require MFA where existing account policy demands.
- **Idempotent purchase binding:** exactly one successful claim per verified purchase (or explicit logged/manual reassignment remedy); simultaneous claims, account switches, repeated checkout events, expired links and forwarded emails must not duplicate or transfer paid service.
- **Account onboarding:** signed-in buyer vs. no existing account, confirmed email, valid/expired beta invite, Google-linked account, legal acceptance (private beta vs purchase terms) and grandfathered accounts; no password reset for an already existing valid account merely to redeem access.
- **Eligibility and clock:** `paid_unfulfilled` ≠ `active_membership`; verify paid feature availability per cohort, first actual usable start, customer experience, February gift and all 12 annual purchased months, delay/mid-month extension, and 7-day refund window from actual usable paid start. Do not start any clock from an invitation send, claim email, Stripe payout or target date.
- **Order changes:** refunds, cancellation and disputes must reconcile before/during access, without changing immutable original payment evidence. Ensure legally required reserves and support receipts.
- **Identity lifecycle:** email changes, merged accounts, account deletion, lost invitation, buyer never signs in, bounced/undelivered email, and post-deletion refund/support: preserve minimum legally necessary order audit while not silently retaining account data.
- **No unnecessary crossover:** Groundwork Lite remains available under its separately approved rules; free Founding Access reservations, organizational sponsorships and future Advanced/Marketplace are not prepaid purchases. No automatic conversion to paid or recurring subscriptions.
- **Release and monitoring:** install nothing into live Groundwork until actual app runtime, authorizations, and legal Terms/Privacy releases are reconciled and an isolated end-to-end test demonstrates fail-closed boundaries.

## Prioritized, bounded next steps

1. **Read-only deployment reconciliation:** identify the actual app release commit, Supabase project used by Lovable Cloud/runtime and existing member access model; the connected inactive project list does not prove live app wiring.
2. **Design review of secure purchase→user claim contract:** separately review exact ownership-verification and refund/account-deletion implications. This is not authorization to deploy a new claim table or route.
3. **Design review of entitlement ledger and actual usable-service clock:** preserve January 2027/February bonus rules including delayed launch and separate refund windows.
4. **Publish only legally approved purchaser Terms/Privacy**, with exact version and stable HTTPS URL, in a separate express founder/legal publication action. Configuring required Stripe hosted terms consent and a genuine Stripe TEST purchase are later, separately approved steps.
5. **Only after explicit implementation authorization**, stage code and synthetic database tests in the appropriate app branch and payment draft branch. Require native CI and narrowly scoped test-only pilot; public checkout, notification sending and any live paid access remain disabled until independent launch authority.

**No changes authorized by this document:** app account schema, Auth configuration, Supabase project, memberships, test/live payment provider, D1, Cloudflare Workers, billing email, customer terms, public website, automatic renewals or PR merges. The user-approved email-invitation *approach* is preserved; these security/operational recommendations are not asserted as additional founder-approved decisions.
