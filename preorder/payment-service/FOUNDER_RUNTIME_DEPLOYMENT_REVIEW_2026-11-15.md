# Founder notification Worker — release-candidate deployment review (2026-11-15)

**Status: review artifact only. DO NOT DEPLOY, MERGE, OR ENABLE SERVICES.**

Scope: Groundworkable/free-bill-preview Draft PR #17, separate Worker `groundwork-founder-notifications-isolated`. Existing payment Worker `groundwork-payment-sandbox-isolated` is out of scope and must remain unchanged.

## Source and artifact
- GitHub Actions `notification-safe-tests` uses Wrangler `--dry-run` to build `founder_notification_worker.draft.mjs` as one Workerd-compatible JS bundle.
- Bundle tests run against the **actual compiled file**, not merely the source. Test coverage includes disabled status/review/dispatch, invalid Access audience/identity, absence of test/payment webhook routes, and no Stripe/Resend network calls with gates disabled.
- Only *after these tests pass*, a separate CI step copies the compiled module and inert 503-only bootstrap into a **short-lived review-only Actions artifact** named `founder-runtime-review-<commit SHA>`. Includes SHA256SUMS and READ_BEFORE_USE.txt. The artifact has no Wrangler deploy action, no D1 binding, no credentials, and no live Access configuration.
- Artifact checksums identify **contents only**. They do not prove or authorize a safe Cloudflare production deployment.
- The current live Worker continues to run `founder_notification_bootstrap.disabled.mjs` responding `Founder service disabled` (503). Founder sign-in and the two identity vars were founder-confirmed at the previous checkpoint, not independently re-read via a Cloudflare management API in this session.

## Blocker — deployment must preserve live dashboard configuration
The existing draft `wrangler.founder-notification.draft.toml` contains `workers_dev=false` and `preview_urls=false`, reflecting its original no-route preparation phase. The current standalone Worker already has an **Access-protected workers.dev URL**. **Never deploy this draft TOML unchanged:** it may remove/disable the active protected workers.dev endpoint or overwrite dashboard-owned variables.

Before proposing any real deploy, obtain an independently reviewed **read-only** snapshot of:
1. Exact Worker name, deployed version ID, workers.dev route status, preview URL settings, and presence/absence of custom routes/domains.
2. Cloudflare Access application attached to **this Worker only**, its scope **All traffic**, exact single-founder Allow policy, and its AUD tag (keep the full value private).
3. The two existing production variables `FOUNDER_ACCESS_AUD` and `FOUNDER_ACCESS_EMAIL`: names, types, and presence. Verify they are retained; do not print their private contents in CI logs.
4. Current source/bootstrap, enabled compatibility date/flags, settings and any existing bindings (expected zero).
5. Cloudflare mechanisms that will preserve **dashboard-managed variables, Access protection, workers.dev routing, and other bindings** when updating script content. A `keep_vars` option alone does not prove preservation of routing or Access. Prefer a minimally scoped content-only update method only after reviewing its exact API behavior.

**Fail closed** if anything is missing, different, or ambiguous. Never replace a dashboard-managed configuration using an unreviewed Wrangler configuration.

## Disabled operational configuration required for *any* later approved code replacement
```text
FOUNDER_NOTIFICATION_ADMIN_MODE=disabled
FOUNDER_NOTIFICATION_REVIEW_ENABLED=false
FOUNDER_NOTIFICATION_DISPATCH_ENABLED=false
NOTIFICATION_SEND_MODE=disabled
NOTIFICATION_OPERATOR_RELEASE=false
NOTIFICATION_TEMPLATES_APPROVED=false
PAYMENTS_MODE=disabled
TERMS_APPROVED=false
TERMS_VERSION=UNAPPROVED
```
Preserve `FOUNDER_ACCESS_AUD` and `FOUNDER_ACCESS_EMAIL` exactly. The reviewed draft runtime returns `service_disabled` for its three named operations when Admin remains disabled, but unknown paths return `not_found`. **Do not conflate this with the old bootstrap, which returns text `Founder service disabled` on all paths.** Runtime replacement therefore changes observable 503 response text/JSON and 404 handling even while functionality remains disabled.

No `DB` binding, Stripe/Resend keys, HMAC keys, provider calls, templates or email delivery in this release stage. No Cloudflare deployment without a **new, explicit, exact-scope founder approval** and verified rollback.

## Deployment review gate (not an execution instruction)
- Record approved bundle SHA256, corresponding commit, target Worker and previous deployment/version ID.
- Verify Cloudflare Access in an unsigned/incognito session denies unauthenticated access, and existing signed-in founder receives the inert bootstrap *before* change.
- Review the exact upload/deployment method for preserving dashboard settings, routing, Access app, vars and bindings. Require a narrowly scoped change and a repeatable rollback to previous version or inert bootstrap.
- Require a **staged, reversible release approval** explicitly authorizing code replacement only; Admin/Review/Dispatch/Payments/Send stay disabled.
- After any later approved deployment verify unauthenticated denial, founder identity, wrong-identity rejection, disabled 503 endpoints, no customer data/secret exposure, no D1/Stripe/Resend activity, and payment receiver unaffected. If anything fails, restore the recorded previous version/bootstrap and disabled settings. Do not automatically retry sends.

## Not authorized
No merging Draft PR #17; no production or sandbox payment collection; no Stripe links/webhooks; no Resend transport or templates; no notification review/dispatch release; no D1 binding or migration; no public checkout; no modification of the payment receiver or website. An artifact upload is **not** a production release.
