# Founder-only Access runtime binding checkpoint — 2026-11-15

**Status: cloud-side Access policy installed and founder sign-in verified; operational runtime remains UNDEPLOYED.** No Stripe, Resend, customer email, payment processing, checkout, production database or existing payment Worker modification is authorized here.

## Grounded cloud-side evidence (founder screenshots)

1. Cloudflare Workers & Pages shows the separate Worker **`groundwork-founder-notifications-isolated`** created, with **zero bindings** and a workers.dev address.
2. The Worker code editor shows the active 503-only inert bootstrap. Following this, a browser request displays `Founder service disabled`. It cannot access D1, Stripe, Resend or notification routes.
3. Cloudflare Access policy on this **individual Worker only** is **All traffic** (production and preview), with existing Allow policy **Groundwork Owner Only** scoped to **`groundworkbyable@gmail.com`**.
4. Cloudflare Access application values panel exposes the app's **AUD tag** and JWKS URL. The full AUD is **not yet in a verified tool-readable source** and must never be guessed or copied from the visually truncated screenshot.
5. Founder demonstrated an unauthenticated Incognito visit redirected to the Cloudflare Access sign-in form, then after signing in as founder reached the inert bootstrap response `Founder service disabled`. Wrong-email rejection/revocation remains unverified.

## Next bounded Cloudflare Console operation: two non-secret identity bindings ONLY

In **Workers & Pages → `groundwork-founder-notifications-isolated` → Access** use the **copy icon** beside **AUD tag**; do not try to transcribe the clipped preview text. In this same new Worker's **Settings → Variables and Secrets** add two independently named **Text / Variable** values in the Production environment:

- `FOUNDER_ACCESS_AUD` = the **full exact** copied AUD value from this Worker's Access application. No leading/trailing whitespace and no guessed value.
- `FOUNDER_ACCESS_EMAIL` = `groundworkbyable@gmail.com` (the exact reviewed owner account).

These are identity **configuration values**, not bearer tokens or private keys. No need to send the actual AUD in a chat. If the UI saves and deploys variables, confirm it remains scoped to this standalone Worker and preserves the 503 bootstrap source. Afterward, verify **exactly those two** names are visible as separately named text variables and the authenticated Worker still shows `Founder service disabled`.

Do **not** add `FOUNDER_NOTIFICATION_ADMIN_MODE=sandbox_access_only`, do not create `DB` binding yet, and do not add API keys or HMAC secrets. Missing/disabled admin configuration is deliberate fail-closed behavior. **Do not** edit `groundwork-payment-sandbox-isolated` or alter its variables, routes, or bindings.

## Code/package prerequisites before deploying the actual draft runtime

- `founder_notification_worker.draft.mjs` imports **`notification_sender.sandbox.mjs`**, **`notification_provider_adapters.sandbox.mjs`**, and **`notification_reviewer.draft.mjs`**, which themselves import `worker.mjs` for verification helpers. Cloudflare's console code editor is not a JS bundler: **do not paste the single module into that editor** and assume these dependencies are deployed. Prepare a reviewed bundled Workerd-compatible artifact or separately approved Wrangler deployment procedure.
- The existing `wrangler.founder-notification.draft.toml` is a **pre-Access preparation scaffold** (`workers_dev=false`, `preview_urls=false`, no bindings); it is **NOT** an approved production deployment configuration. In particular, applying it verbatim could alter the now-protected workers.dev URL. Review routing and all bindings before any deploy.
- Bundle review must ensure **no test-only entrypoints, local mock routes, or provider secrets embedded**. Do not introduce uncontrolled deployment paths or automatic customer delivery. The current source's Access validation and flags must be tested against the real app's AUD/identity under disabled configuration before enabling any admin or notification functions.
- Access policy currently protects all traffic and is not interchangeable with a public payment receiving webhook. The existing payment receiver is a distinct Worker and remains fail-closed.

## Release gates

1. Two *non-secret* identity variables stored on the separate Worker while the inert bootstrap remains active — **pending founder action**.
2. Identity-variable presence and post-save bootstrap recheck — **pending verification**.
3. Bundle/packaging, disabled-runtime route tests, exact reviewed D1 binding and future runtime deployment — **not authorized or performed**.
4. Access revocation, wrong-account denial, Stripe/Resend integrations and template publication — **not verified or authorized**.

No new recurring service, new product functionality, or feature scope is created by this checkpoint.
