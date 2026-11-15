# Groundwork founder Worker — post-rollback implementation checkpoint (Nov 15, 2026)

## Cloudflare incident: reverted to known-good bootstrap

The founder accidentally selected **Deploy** in Cloudflare while staging the reviewed founder-only notification Worker. The founder then used Cloudflare's rollback control and supplied a **post-rollback Deployments screenshot**. The screenshot visibly confirms:

| Property | Observed production UI |
| --- | --- |
| Worker | `groundwork-founder-notifications-isolated` |
| Current active version | `1f97ea8e` at **100% traffic** |
| Full original version ID (previously copied) | `1f97ea8e-4ba6-47d9-87f6-11594c938cc1` |
| Newer historic deployment | `22367a82` shown as **Manually deployed**, Ready, but **not active** |
| Request rate / error rate at screenshot | 0 requests/sec / 0% error rate (snapshot only) |

**Important:** The screenshot verifies the restored traffic allocation, **not** a full post-rollback authenticated 503 response, runtime-variable values, Access AUD equality, or evidence of no request/notification during the brief accidental deployment. Do not overclaim these. Historical `Ready` means deployable, not currently receiving production traffic.

## What this changes about the rollout plan

**DO NOT repeat the earlier instruction to paste the bundle and click Save or Deploy.** A newer Cloudflare version already exists, after the accidental deployment. Version `22367a82` **may** be the reviewed package, but that has **NOT** been established by a read-only source/version comparison. There is no reason to upload it again until that question is settled.

The existing 503 bootstrap is back at 100%; leave that routing in place.

The latest successfully tested repository review artifact at the time of rollback:
- PR #17 commit `124f9ea5775788842907b984489327d2a0c0ee4f`;
- GitHub Actions run [43762783601](https://github.com/Groundworkable/free-bill-preview/actions/runs/43762783601) (both jobs passed);
- review artifact `founder-runtime-review-124f9ea5775788842907b984489327d2a0c0ee4f`;
- approved-for-review-only candidate config includes `keep_vars=true`, `workers_dev=true`, `preview_urls=false`, nine disabled operational flags, **no DB** and **no Stripe/Resend secrets**.

A Cloudflare dashboard **manual code paste and Deploy** is NOT the same operation as `wrangler versions upload --keep-vars --strict`. Do not assume the deployed historic version inherited every dashboard variable or Access setting. Confirm by inspecting its metadata or dashboard variables before considering activation.

## Read-only next gate (no redeployment)

1. Run fresh existing *credential-free* checks against the current production endpoint: founder unauthenticated request must encounter Cloudflare Access; separate payment Worker must remain disabled and hide test routes. This does not prove signed-in 503 response.
2. In a separately authenticated Cloudflare-owner environment, inspect the **historical** version `22367a82` by its full version ID (retrieve it only if necessary). Verify the candidate code, runtime bindings, operational flags and compatibility. Compare with the exact tested GitHub artifact. Do **not** send raw version JSON, secrets or private identity values through GitHub/chat.
3. Recheck current Worker policy: All traffic → founder-only; workers.dev enabled; preview URL disabled; original ID at 100%; identity variables unchanged.
4. Before a **separately authorized** production rollout, decide whether the historic version is safe to reuse. If not verified, retain the current inert version; **no automatic re-upload**.
5. A production rollout would require its own explicit authorization, an agreed rollback to `1f97ea8e-4ba6-47d9-87f6-11594c938cc1`, and logged verification. Never activate the nine operational gates, notification sending, public checkout, Stripe links or payment webhook as part of this Worker's code rollout.

**No account mutation is performed by this checkpoint.** Draft PR #17 remains unmerged. These facts are based on founder screenshots and CI, not an authenticated Cloudflare-management connector.

## Why the historical version matters

The post-rollback Cloudflare deployment list now includes `22367a82` alongside `1f97ea8e`. The original staging goal of obtaining an inactive candidate version may already be satisfied, depending on what that earlier version actually contains; **verification, not another deployment**, is the next logical action.

## Full historical version identifier and genuine read-only code inspection

Founder copied historical version UUID `22367a82-2713-4f1f-b927-65301fe75a17`, matching the `22367a82` short ID in the rollback screenshot. This is the accidentally deployed version, **not the currently active** Worker.

Cloudflare's documented GET endpoint `/accounts/{account_id}/workers/workers/{worker_id}/versions/{version_id}?include=modules` returns module bytes and version metadata. The read-only deployments-list endpoint returns the actively serving version as its first result. This makes it possible to compare the historical code to the exact CI bundle, not merely infer parity from timestamps or labels.

Added `founder_historical_version_inspect.py`. With an **existing privately held, read-only** Cloudflare API token (`CLOUDFLARE_API_TOKEN`) and account identifier (`CLOUDFLARE_ACCOUNT_ID`) set in the founder's shell, run:

    python3 preorder/payment-service/founder_historical_version_inspect.py --check

The script performs two **GET-only** requests, retains responses in process memory, never prints source/module bytes/credentials/identity values, checks single JS module SHA256 `63282db30b16f3ed46a1ac0dfd1c8a5e6702a759a88bb93d7404e1ab74330f8d` (from passing CI), requires identity variables and any declared operational variables to be disabled, rejects other bindings, and verifies original `1f97ea8e-4ba6-47d9-87f6-11594c938cc1` remains at 100%. The tool **fails closed** if Cloudflare's API response shape or transformed code differs. An exact code mismatch means **UNVERIFIED**, not proof of a harmful upload.

Run `--self-test` without credentials to validate synthetic guard fixtures. CI runs this synthetic test only; **it does not access the Cloudflare account**.

Cloudflare API references: https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/get/ ; https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/list/ .

**No API token was created, read, or requested in chat. No Cloudflare changes; no version promotion.**
