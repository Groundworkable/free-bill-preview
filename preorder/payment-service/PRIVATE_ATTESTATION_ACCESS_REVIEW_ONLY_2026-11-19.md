# Private purchaser-attestation Access boundary — REVIEW ONLY

**Status:** DRAFT / not deployed or configured. Stripe checkout/webhook, Cloudflare payment Worker, and customer emails remain disabled. This is *not* authorization to create a new Worker, Access application, token, hostname, or secret.

## Current operational gate — independently checked November 19, 2026

**Use this section rather than older superseded same-host deployment suggestions below.** The selected draft is a **separate** future Worker, NOT an additional route on `groundwork-payment-sandbox-isolated`.

**Current account state is NOT inspected.** No connected Cloudflare account-management tool is available; public documentation cannot establish which Access applications, service tokens, policy conflicts, hostname reservations or billing plan actually exist. Do not create/reconfigure anything merely because the source tests pass.

1. **Account read-only preflight (founder browser / Work):** Cloudflare dashboard → **Zero Trust → Access controls → Applications**. Check that Zero Trust exists, inspect the application list for overlapping host/path policies and report only nonsecret policy names, actions, matching hostname/path and current plan. Then **Workers & Pages**: inspect the separate candidate name's availability and existing isolated webhook Worker name. Do not alter the webhook Worker, or use a Worker-wide / Protect-all setting.
2. **Planned distinct test-only origin, NOT provisioned:** `https://groundwork-private-attestation-test.groundworkbyable.workers.dev` with exact protected path `/internal/test-prepurchase-attestation`. The app and payment private worker must use the same approved origin. No corresponding hostname currently confirmed. No route should go live before a **Service Auth-only** Access policy explicitly includes only the dedicated machine service token. Do not add Allow/Bypass or broad token tag selectors.
3. **Crucial inert-config compatibility:** `wrangler.private-attestation.DRAFT_DO_NOT_DEPLOY.jsonc` deliberately has `workers_dev:false` and `routes:[]`. Cloudflare docs say `workers_dev:false` DISABLES the `workers.dev` deployment URL. Therefore the current candidate **cannot receive HTTP requests** at the proposed origin. Only after the Access application and service-token policy are in place and verified may a separately reviewed configuration enable this **new Worker's** exact `workers.dev` route (or select and update all caller/worker origin contracts for a dedicated custom domain). Never change the original webhook Worker route.
4. **Account charge gate:** Cloudflare advertises Zero Trust Free ($0 for small teams) and Workers Free usage, but that does not establish this account's actual plan or whether limits/paid features apply. Inspect account billing **before** any upgrade, new recurring subscription or enabling paid Worker features; do not assume a new charge is authorized.
5. **Before any signed real TEST traffic:** verify dedicated hostname routes to the new Worker; strict Service Auth credentials accepted; no unauthenticated/human login bypass; Cloudflare-runtime `ctx.access.aud` matches the intended Access application; private Worker D1 binding and reviewed nonce ledger present; all HMAC keys server-held; original payment Worker remains `PAYMENTS_MODE=disabled`. Token secret is shown once at creation—never paste into a chat, GitHub, test log, screenshot or URL.
6. **Separate buyer gate:** app sandbox project `jcrwjhhuaihjlywjflbv` already exists. Before buyer OTP/claim issuance, independently establish a founder-controlled new Auth session and the original TEST buyer mailbox, and verify the dedicated sandbox-only service key belongs to that project. No real email or permanent Auth identity is authorized by a read-only preflight.

**No-deploy checkpoint:** Complete step 1 with the actual account view, then review the exact plan/policy conflicts before any resource creation. This is a setup gate, not an instruction to send a test checkout or enable member access.

Sources (independently read November 19, 2026):
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/
- https://www.cloudflare.com/sase/products/access/
- https://developers.cloudflare.com/workers/platform/pricing/

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

## Updated deployment decision — separate Worker origin REQUIRED (November 19)

The review uncovered a conflict between the two previously considered approaches: Cloudflare supports **path-scoped Access** on a shared Worker, but this code is a **standalone Worker entrypoint**. Deploying a standalone Worker to the original webhook hostname could replace that existing Worker's routing or otherwise disrupt webhook delivery. The private draft now **requires a different, explicitly configured origin** and rejects the original webhook host, even when all other auth credentials are present.

The current source contracts are `GROUNDWORK_PREPURCHASE_PRIVATE_ORIGIN` (app) and `PURCHASE_ATTESTATION_PRIVATE_ORIGIN` (private payment Worker). Both must be exactly the same **new** approved HTTPS Worker hostname. All tests use a synthetic, **not provisioned** private hostname. The code does not pick or create a real hostname. Path stays `/internal/test-prepurchase-attestation`; the signed request canonicalization binds that path. The original `groundwork-payment-sandbox-isolated.groundworkbyable.workers.dev` is explicitly forbidden in both draft components.

**This supersedes the earlier "preferred minimum-change" same-host, path-scoped approach for the current standalone Worker design.** The earlier option would instead require integrating the handler into the existing Worker, which has been excluded from this draft to protect the already-tested Stripe webhook. Do not combine those designs accidentally.

Before any future deployment, the founder must separately approve: (1) the precise new Worker name/hostname and whether it creates a cost, (2) a scoped Cloudflare Access Service Auth policy and token on that new hostname/path, (3) migration of the isolated D1 nonce ledger, (4) segregated server-held keys and secrets, and (5) runtime tests showing the old webhook Worker was not changed. **No approval or deployment occurred during this code correction.**

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
