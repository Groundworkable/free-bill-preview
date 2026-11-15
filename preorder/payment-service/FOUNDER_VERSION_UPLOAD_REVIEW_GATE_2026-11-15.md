# Founder notifications: version-upload method review — November 15, 2026

**Draft PR #17 | preparation only | NO remote version upload, deployment, or live feature activation approved**

## Why version upload, not deploy
Cloudflare distinguishes creating a Worker *version* from creating a *deployment* that routes production requests. A separately authorized `wrangler versions upload` would create a version without turning it on. Upload still changes the Cloudflare account, so **even an unactivated upload requires explicit founder approval**. A `wrangler deploy` would instead affect the active Worker and is **NOT authorized** at this checkpoint.

Cloudflare references:
- https://developers.cloudflare.com/workers/wrangler/commands/
- https://developers.cloudflare.com/workers/versions-and-deployments/
- https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- https://developers.cloudflare.com/workers/wrangler/configuration/

## Verified current production baseline (founder screenshots)
- Worker: `groundwork-founder-notifications-isolated`; version shown `1f97ea8e` (short UI identifier), 100% traffic.
- Production workers.dev route enabled, preview URLs disabled, no custom domains/routes.
- Cloudflare Access: All traffic, Groundwork Owner Only Allow exact founder identity.
- Production variables: exactly `FOUNDER_ACCESS_AUD` and `FOUNDER_ACCESS_EMAIL` (values must not be committed or shared). No connected bindings.
- Compatibility date: `2026-11-15`; no flags displayed, placement Default, cache Disabled.
- Disabled live bootstrap previously founder-verified to return HTTP 503 `Founder service disabled`.
- Wrong-account denial, full version UUID, exact AUD equality, and preservation across any remote upload remain **unverified**.

## CI verification — no Cloudflare credentials
On commit `8e8c99cffac3bcb410fa08fa0829f759c2998763`, GitHub Actions [run 43739120421](https://github.com/Groundworkable/free-bill-preview/actions/runs/43739120421) passed both `notification-safe-tests` and `remote-worker-fail-closed`. Added an explicit **version upload --dry-run** stage using the proposal TOML (with `workers_dev=true`, `preview_urls=false`, `keep_vars=true`, exact Worker name and nine closed operational gates), `--strict`, and blank `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`. It builds locally and is examined by `founder_version_upload_dry_run.test.mjs` for disabled endpoints and absence of test/webhook routes or network calls. All existing Workerd mocks/ledger tests also passed.

**IMPORTANT:** CI confirmed *syntactic feasibility and local bundle behavior*, not real Cloudflare-side version metadata preservation. It never called the Cloudflare API and never changed production.

## Required separate gates before even a non-live upload
1. Review the **full existing active version identifier** and confirm the ability to restore it in Cloudflare's Deployments UI. Do not rely on truncated `1f97ea8e` as an API-ready version UUID.
2. Compare the candidate's actual uploaded metadata / variable merge behavior against the current dashboard-owned production settings. In particular, `keep_vars` is not proof that Cloudflare Access or workers.dev routing will remain unchanged.
3. Confirm how the nine disabled `[vars]` entries would coexist with the two existing identity variables, and that no inherited/extra bindings would be introduced or removed.
4. Review handling of Cloudflare's *non-deployed* version and its preview accessibility; previews must remain disabled and protected behind Access, with no public bypass.
5. Preserve version rollback and live-bootstrap code before any authorized deployment, with manual response checks and no automatic provider sends.
6. Obtain founder's **explicit, bounded authorization** naming the operation, target Worker, bundle hash, version IDs, and intended no-activation state. 'Onward' is not such an authorization.

## Later, after separately approved upload
- Verify new version exists but active traffic remains 100% on the original approved `1f97ea8e` version.
- Verify Cloudflare Access policy, production URL, preview-disabled status and identity variable names remain unchanged.
- Inspect uploaded version metadata and its code size/hash without exposing secrets.
- Separately authorize any production deployment only after this review, keeping Admin/Review/Dispatch/Stripe/Resend/Terms/Checkout disabled.
- If any difference occurs, **STOP**, restore prior settings or remove/reject candidate as appropriate. Never silently activate it.

**This document is the boundary, not an execution script. No Cloudflare upload/deploy, D1 binding, Stripe/Resend credentials, public checkout, email, or PR merge has occurred.**
