# Private purchaser-attestation Access boundary — REVIEW ONLY

**Status:** DRAFT / not deployed or configured. Stripe checkout/webhook, Cloudflare payment Worker, and customer emails remain disabled. This is *not* authorization to create a new Worker, Access application, token, hostname, or secret.

## Security boundary

Cloudflare's current Workers Access documentation says authenticated direct Worker requests expose `ctx.access` with `aud`; unauthenticated requests have no `ctx.access`. Client-to-Access service authentication uses `CF-Access-Client-Id` and `CF-Access-Client-Secret`. Access **does not propagate** `ctx.access` through Service Bindings. Sources:

- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/

The TEST-only app draft now requires server-side Access service token credentials and sends them as headers, in addition to the existing bearer token and signed body. Payment handler draft now **fails closed** if the provided platform-authenticated `ctx.access.aud` is absent or does not match `PURCHASE_ATTESTATION_ACCESS_AUD`. The handler function is deliberately UNROUTED; only a future reviewed Worker fetch entry may pass `ctx.access` from Cloudflare's third runtime parameter. It must **never** accept a fabricated access context from request headers, JSON bodies, browser clients, or an upstream caller's unchecked assertion.

**Critical:** the `aud` alone proves that the request was authenticated against a specific Access application; it does **not** itself prove a service token rather than a human login. A future Access application MUST have an explicit **Service Auth** policy selecting only the intended service token. No generic Allow or Bypass policies, no ordinary employee/email login access, and no broad matching service-token tags. Enable or verify strict service-token authentication when possible; audit current policies and other hostname/Worker precedence before routing.

## Route isolation

The original isolated Worker `groundwork-payment-sandbox-isolated` includes a Stripe webhook endpoint. Applying **Worker-level** Access to the entire Worker would also protect its Stripe webhook, which cannot present the app's service token. **Do not do that.**

A reviewed configuration must use a **path/hostname-specific Access application** for ONLY the private attestation route, or a dedicated private attestation Worker/hostname **with its own** Service Auth policy. No new deployment or expense is authorized by this document. Confirm Cloudflare Access matching/precedence on every route and ensure public webhooks do not bypass or inherit the attestation route's access policy.

The current draft handler URL is fixed to `https://groundwork-payment-sandbox-isolated.groundworkbyable.workers.dev/internal/test-prepurchase-attestation`. This is a **contract for tests**, not an existing exposed route. **Cloudflare's Workers Access documentation (updated November 2, 2026) explicitly supports hostname/path-specific self-hosted Access applications on `workers.dev` hostnames.** The existing intended path is therefore a supported Access application target; deploying a new hostname solely for this feature is not required by the documentation. See https://developers.cloudflare.com/workers/configuration/cloudflare-access/ (Protect a specific hostname, Custom Domain, or path).

**Preferred minimum-change design for later review:** create a narrowly scoped self-hosted Access application matching ONLY `groundwork-payment-sandbox-isolated.groundworkbyable.workers.dev/internal/test-prepurchase-attestation` with a **Service Auth** policy including ONLY a dedicated intended service token. Do not use Worker-level or account-wide Access for this shared Worker, and do not add a broad `Allow` or `Bypass` rule to its private attestation path. Cloudflare policy matching gives hostname/path-based Access priority above broader Worker-level or account-level policies, but actual rules/policies and precedence in this account **have not been inspected**. See https://developers.cloudflare.com/cloudflare-one/access-controls/policies/ (Service Auth) and https://developers.cloudflare.com/workers/configuration/cloudflare-access/ (Understand Access hierarchy).

**Remaining account-specific checks before any configuration or route:** verify Zero Trust is available, that the exact `workers.dev` hostname/path is accepted by the dashboard, that no conflicting Access application overrides it, that only the private path matches the restricted policy, and that the original `/webhooks/stripe` path remains unaffected. No Service Auth application, token or route has been created. If actual account configuration contradicts the documented path option, do not fall back to whole-Worker Access; pause for a separately reviewed isolated host and update the app URL, transport HMAC path, expected Access audience and tests together.

## Required layered checks

1. Access Service Auth policy authenticates only the intended service token at the exact protected hostname/path and sets `ctx.access`.
2. The draft Worker checks `ctx.access.aud` against a separately configured audience string, BEFORE reading or writing D1.
3. A distinct TEST bearer token is checked; complete HTTP body, method/path, timestamp, nonce are HMAC signed by the app.
4. Signed buyer mailbox/account proof independently verifies the Checkout order and account before D1 read.
5. An atomic, append-only D1 nonce ledger prevents repeated requests and concurrent replay. **Draft migration remains UNAPPLIED remotely.**
6. Stripe TEST and isolated D1 are freshly verified; known refunds/disputes block issuance. Pending-only claims do not activate membership.

All gates default OFF; secrets are to be entered only into reviewed server-side secret stores, never source code, GitHub PR discussions or user-facing pages. Rotate/revoke Access tokens and HMAC credentials using a documented procedure. Avoid auto-enabling Cloudflare Access or payment routes by virtue of CI success.

## Current verification and outstanding work

- Source code and synthetic tests only. Mock `ctx.access` is permitted **inside tests only**.
- No live Access Service Auth application or service token has been inspected, provisioned, or verified.
- No customer-facing HTTP route is deployed. Payment receiver remains `PAYMENTS_MODE=disabled` and the original Stripe TEST links/webhook are OFF.
- A real sandbox founder-controlled Supabase Auth session and independently consented buyer-mailbox proof, a remote D1 nonce migration review, and genuine end-to-end test are still outstanding.

**Operational stop gate:** do not wire any route or provider secrets until policy precedence, service-token-only authorization, D1 migration, runtime target, cost, and a real authorized sandbox test identity are reviewed and explicitly approved.
