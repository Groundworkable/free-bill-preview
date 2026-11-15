# Groundwork Payments — Founder-only runtime release decision record
**November 15, 2026 · Draft PR #17 · Decision: NO-GO for Cloudflare upload or deployment**

## Bounded scope
This record applies **only** to the existing Cloudflare Worker `groundwork-founder-notifications-isolated`. It does **not** apply to `groundwork-payment-sandbox-isolated`, the public marketing website, Cloudflare D1 migrations, Stripe checkout/webhooks, Resend deliveries, or general application release. Founder saying `onward` authorizes continuing **offline review**, not a Cloudflare version upload, deployment, or change in feature flags.

## Evidence in hand
- Founder-supplied screenshots from Cloudflare dashboard on Nov 15, 2026:
  - Worker production workers.dev route enabled, preview URLs disabled, no custom domains/routes.
  - Worker Access policy = All traffic, Groundwork Owner Only, Allow rule tied to exact founder identity.
  - Exactly two production variables displayed: `FOUNDER_ACCESS_AUD` and `FOUNDER_ACCESS_EMAIL`; **no connected bindings**.
  - Active version shown as short dashboard ID `1f97ea8e` at 100% traffic, with earlier entries `e8cdb15e` and `1801d112`.
  - Compatibility date `2026-11-15`, no flags displayed, runtime placement Default, cache Disabled.
  - Previously authenticated founder saw bootstrap response HTTP 503 `Founder service disabled`.
- GitHub Actions `43740339583` at commit `e56e842555a0a2f8bdd7044942048f197620bca6`: both CI jobs succeeded.
  - Wrangler `4.162.0` local `versions upload --dry-run --keep-vars --strict` reports *nine disabled operational variables* and no declared provider or database bindings.
  - Compiled version-upload bundle is byte-for-byte identical to the disabled-route-tested bundle.
  - Candidate content SHA256 in that run: `63282db30b16f3ed46a1ac0dfd1c8a5e6702a759a88bb93d7404e1ab74330f8d`.
  - These are **offline checks**; the two dashboard identity variables do not appear in the local binding summary, and no upload-side preservation behavior has been established.
- Draft PR remains unmerged. No deploy, new Worker version upload, payment, email, or route change is authorized.

## Cloudflare documentation cross-check
Cloudflare's documentation, updated Nov 12, 2026, distinguishes **versions** (code, assets, bindings, compatibility settings) from **deployments** (versions actually serving traffic). `wrangler deploy` both uploads and deploys, while an independently controlled version-upload operation can stage an inactive version. A rollback creates a **new deployment pointing 100% at a selected previously deployed version**. Rollback does not reverse D1/KV/R2/storage state and is limited to the 100 most recently published versions; some changed or deleted resource bindings can prevent rollback.

Sources:
- https://developers.cloudflare.com/workers/versions-and-deployments/
- https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/wrangler/configuration/

## Release conditions — STOP unless each is satisfied

| Condition | Current evidence | Status |
| --- | --- | --- |
| Exact target Worker and scope | Screenshots and candidate TOML | **PASS (review-only)** |
| Active production version short ID and traffic | `1f97ea8e` at 100% | **PASS (short ID only)** |
| **Full active version ID** retained as rollback target | Not yet copied from dashboard | **OPEN / NO-GO** |
| Worker's route, Access protection, runtime date/flags, identity variable names, bindings | Multiple dashboard screenshots | **PASS (observed baseline)** |
| AUD tag equals runtime AUD variable | Full values correctly withheld | **NOT VERIFIED** — compare privately, never paste into GitHub |
| No Access bypass on wrong account | Not independently tested | **NOT VERIFIED** |
| Actual Wrangler upload preserves dashboard identity values, Access and route | Local `--keep-vars` dry run only | **NOT VERIFIED** |
| One-time inactive version upload authorization | No such authorization | **NO-GO** |
| Separate production rollout authorization | Not sought | **NO-GO** |
| Payment/notification dispatch/checkout release | All remain disabled | **NO-GO by design** |

### One safe founder action to close the next evidence item
In **Cloudflare → Workers & Pages → `groundwork-founder-notifications-isolated` → Deployments**, use the small **copy icon next to the current active `1f97ea8e` entry** and paste only the copied **version identifier**, or open its read-only details if the icon copies only the eight-character prefix. This is an identifier, **not** a credential. Do not click Deploy or Rollback or change any settings. If it still shows eight characters, report that instead of guessing.

### AFTER (and only after) separate bounded authorization for an inactive upload
1. Record exact PR commit, review artifact checksum, full current active version ID, target Worker, disabled operational settings, and chosen version-upload command/config.
2. Confirm the CLI's treatment of dashboard-managed production variables and Worker-level Access configuration. If this cannot be confirmed, **stop rather than assume `keep_vars` alone is enough**.
3. A founder-approved **version upload** may then occur without creating a production deployment. The upload **still changes the Cloudflare account** and is a separate approval event.
4. Verify, using read-only dashboard evidence, the active deployment still routes 100% to the original known-good version; no preview/route/Access changes, no new bindings or secrets, and an uploaded inactive version is visible with correct metadata.
5. Only a *subsequent*, distinct approval could authorize sending any traffic to the replacement code. Admin, review, dispatch, all provider sends and all payment/legal gates must remain disabled; no DB binding.
6. If activation is later approved: immediately recheck unauthenticated denial, founder access, wrong-user denial, original production URL, restricted API responses, absence of provider calls and customer-data leakage. If any mismatch, use Cloudflare's documented rollback to restore the known-good version and re-verify; never automatically retry a notification.

**Current decision remains NO-GO for any remote mutation.** This file is a handoff and decision record; it is not a deployment instruction, CI release step, or implied authorization.
