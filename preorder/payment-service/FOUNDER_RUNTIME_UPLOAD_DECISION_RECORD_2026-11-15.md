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

## Cloudflare preservation semantics verified against current documentation (Nov 15, 2026)

**Documented, not live-tested:** Cloudflare's Wrangler `versions upload` explicitly supports `--keep-vars` (normally false): when enabled, existing environment variables are **not deleted before adding configured variables**. `--strict` stops uploads with conflicting remote changes. The candidate and pinned CI command both include these options. Therefore Cloudflare's *published behavior* supports retaining `FOUNDER_ACCESS_AUD` and `FOUNDER_ACCESS_EMAIL` while adding nine disabled operational flags. This does **not** prove preservation on this specific Worker until a separately authorized staging/upload and subsequent metadata check.

Worker-level Access is attached by **Worker ID** to the Worker (not by the active script's version prefix) and, when configured for **All traffic**, protects all domains/routes associated with it. This supports the existing owner-only Access app continuing across code-version changes, *assuming no Worker identity, Access policy, or routing changes*. Confirm this by read-only inspection before and after any future upload, rather than assuming.

Wrangler supports read-only `versions view <FULL_VERSION_ID> --name groundwork-founder-notifications-isolated --json` and `deployments list --name groundwork-founder-notifications-isolated --json`. These commands require a separately authenticated Cloudflare environment; none is available in the GitHub CI check, and they were **not run**. Do not paste raw outputs containing variable values or secrets into tickets or chat.

References:
- https://developers.cloudflare.com/workers/wrangler/commands/workers/ (`versions upload`, `--keep-vars`, `--strict`, `versions view`, `deployments list`)
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/ (`Protect one Worker`, `worker` destination)
- https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/

**Residual blockers:** Cloudflare-authenticated source/version metadata inspection, verification of matched AUD without disclosing it, negative Access-policy validation, and bounded founder approval for any remote mutation. Full active version ID has already been captured; do not request it again. Rollback eligibility is documented but not exercised.

## Read-only metadata inspection authorization — November 15, 2026

The founder responded **"approved onward"** to the preceding proposal to inspect Cloudflare's existing Worker version metadata **read-only**. Scope is limited to inspection. No permission for a new version upload, traffic deployment, rollback, Access policy edit, variable edit, Worker route change, D1 mutation, or payment/notification activation is implied.

### Available read-only inspection methods

**Preferred Cloudflare dashboard:** Workers & Pages → `groundwork-founder-notifications-isolated` → **Deployments** → current active version `1f97ea8e-4ba6-47d9-87f6-11594c938cc1` → version details (if available). Inspect the exact version ID, production traffic share, compatibility date/flags, bindings **names/types only**, and any indicator of rollback eligibility. If submitting screenshots, **redact values of every variable, tokens, JWT, URLs with credentials, account IDs and private audience/JWKS material**; keep field labels and version ID visible. Do not click Deploy, Rollback or Edit.

**Alternate CLI in an already authenticated owner environment (read-only commands only):**
```bash
npx wrangler@4.162.0 versions view 1f97ea8e-4ba6-47d9-87f6-11594c938cc1 --name groundwork-founder-notifications-isolated --json
npx wrangler@4.162.0 deployments list --name groundwork-founder-notifications-isolated --json
```
**DO NOT paste raw CLI JSON into GitHub, ChatGPT or logs**; it may include plaintext variable values and other sensitive metadata. Examine it locally and share only a manually redacted screenshot or a sanitized list of field names and types. Do not ask the founder to produce new Cloudflare credentials, supply tokens in chat, enable account access, or run `wrangler versions upload` / `wrangler deploy`.

Cloudflare documentation confirms these are read-only views:
- https://developers.cloudflare.com/workers/wrangler/commands/workers/ (`versions view`, `deployments list`)
- https://developers.cloudflare.com/workers/versions-and-deployments/

**Current execution status:** No authenticated Cloudflare management connector or account session is available to this ChatGPT conversation. Consequently **the remote version metadata has not been retrieved**, and no production preservation or rollback claim can be made based on this authorization alone.

## Live unauthenticated Access boundary smoke — verified November 15, 2026

At commit `d76dea6ca6f1e9c4a07a3e43c5e86ac78777bab9`, [GitHub Actions run 43743050818](https://github.com/Groundworkable/free-bill-preview/actions/runs/43743050818) passed both jobs. The new `founder_access_unauthenticated_smoke.py` sends **one credential-free GET** to the existing founder Worker with redirects disabled; it never sends a cookie, Access identity token, POST, review or dispatch request, and does not print returned bodies or redirect destinations. It accepts only a recognizable Access login redirect or Access-branded rejection; it fails on the bootstrap's 503, public 200, 404, ordinary 403, unrecognized redirect, network uncertainty, or leaked application response. GitHub job log recorded:

```text
PASS: founder Worker rejects this unauthenticated request with an Access challenge
LIMITATION: exact founder allowlist, AUD equality and logged-in identity are not tested
```

The same workflow separately revalidated that the isolated payment Worker still returns disabled 503 and does not expose local test-only paths. This **closes the single unauthenticated request boundary check**, not the wrong-account/Access audience checks. The probe's domain and behavior are intentionally fixed to the existing founder Worker. No Cloudflare account API was used, no changes were made, and no credentials were supplied.

## Offline Cloudflare version-metadata sanitizer — prepared, NOT run against the account

`founder_version_metadata_redact.py` is a **fail-closed, local-only JSON filter** for the founder's already-recorded active version. It accepts **only**:
- Version UUID `1f97ea8e-4ba6-47d9-87f6-11594c938cc1`.
- Compatibility date `2026-11-15` and an explicitly empty compatibility-flags array.
- Exactly the two expected binding names `FOUNDER_ACCESS_AUD` and `FOUNDER_ACCESS_EMAIL`, with recognized variable binding types `plain_text` or `secret_text`. Any unexpected DB/service binding or unfamiliar response structure fails as **UNVERIFIED**.

The tool emits only fixed success/failure messages and **never outputs raw JSON or binding values**. It has a `--self-test` mode with synthetic hostile fixtures that rejects altered version IDs/dates, flags, duplicate or unknown bindings, malformed structures and missing identity variables. This test requires no Cloudflare login, network request or credentials.

**Limitations:** Wrangler's real response schema can differ; if it does, the filter fails closed and must be reviewed rather than weakened to accept unknown metadata. A successful filtered result does not prove the Worker-level Access policy, protected routing, or the outcome of any future upload. Piping raw metadata into the local filter is only appropriate in an already authenticated, privately controlled environment; do **not** paste it into chat, public GitHub Actions logs or a PR comment.

## Release conditions — STOP unless each is satisfied

| Condition | Current evidence | Status |
| --- | --- | --- |
| Exact target Worker and scope | Screenshots and candidate TOML | **PASS (review-only)** |
| Active production version short ID and traffic | `1f97ea8e` at 100% | **PASS (short ID only)** |
| **Full active version ID** retained as rollback reference | Founder copied exact ID from Cloudflare Deployments: `1f97ea8e-4ba6-47d9-87f6-11594c938cc1`; short ID matches prior screenshot | **PASS (identifier captured)**; rollback eligibility itself remains untested |
| Worker's route, Access protection, runtime date/flags, identity variable names, bindings | Multiple dashboard screenshots | **PASS (observed baseline)** |
| AUD tag equals runtime AUD variable | Full values correctly withheld | **NOT VERIFIED** — compare privately, never paste into GitHub |
| Unauthenticated direct Worker request blocked by Access | One credential-free GET challenged in GitHub Actions run 43743050818 | **PASS (single live probe)** |
| No Access bypass on wrong account | Not independently tested | **NOT VERIFIED** |
| Wrangler variable preservation and Worker-level Access semantics | Cloudflare documentation verifies `--keep-vars` and Worker-ID-scoped Access; local dry run passed | **PASS (documentation only)**; actual live preservation still unverified |
| One-time inactive version upload authorization | No such authorization | **NO-GO** |
| Separate production rollout authorization | Not sought | **NO-GO** |
| Payment/notification dispatch/checkout release | All remain disabled | **NO-GO by design** |

### Full active version ID captured (founder confirmation, November 15, 2026)
The founder used Cloudflare's Deployments copy control and supplied the complete version identifier: `1f97ea8e-4ba6-47d9-87f6-11594c938cc1`. It matches the earlier screenshot's eight-character prefix and the version displayed at 100% traffic. The value is a version identifier, not a credential. This closes the **full ID retrieval** task, but it does not prove rollback eligibility, future restoration behavior, access-policy integrity, or preservation of production variables during an upload. The founder should NOT be asked to retrieve this ID again.

**Next review gate:** reconcile the proposed offline version-upload configuration with Cloudflare's live application protections and verify the future release/restore procedure; no upload or deployment is authorized. Avoid requesting additional Cloudflare UI actions merely to generate more evidence without a concrete need.

### AFTER (and only after) separate bounded authorization for an inactive upload
1. Record exact PR commit, review artifact checksum, full current active version ID, target Worker, disabled operational settings, and chosen version-upload command/config.
2. Reconfirm the documented `--keep-vars` and Worker-level Access behavior against this Worker's current remote metadata; keep `--strict` enabled. If the actual remote settings conflict, **stop**.
3. A founder-approved **version upload** may then occur without creating a production deployment. The upload **still changes the Cloudflare account** and is a separate approval event.
4. Verify, using read-only dashboard evidence, the active deployment still routes 100% to the original known-good version; no preview/route/Access changes, no new bindings or secrets, and an uploaded inactive version is visible with correct metadata.
5. Only a *subsequent*, distinct approval could authorize sending any traffic to the replacement code. Admin, review, dispatch, all provider sends and all payment/legal gates must remain disabled; no DB binding.
6. If activation is later approved: immediately recheck unauthenticated denial, founder access, wrong-user denial, original production URL, restricted API responses, absence of provider calls and customer-data leakage. If any mismatch, use Cloudflare's documented rollback to restore the known-good version and re-verify; never automatically retry a notification.

**Current decision remains NO-GO for any remote mutation.** This file is a handoff and decision record; it is not a deployment instruction, CI release step, or implied authorization.
