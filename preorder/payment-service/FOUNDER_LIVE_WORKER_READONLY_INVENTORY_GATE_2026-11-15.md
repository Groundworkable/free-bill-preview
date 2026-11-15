# Founder Worker — live deployed-state read-only inventory checkpoint
**2026-11-15 · Draft PR #17 · REVIEW ONLY — NOT APPROVED FOR ANY CLOUDFLARE UPLOAD OR DEPLOYMENT**

Target is **only** Cloudflare Worker `groundwork-founder-notifications-isolated`. Do not operate on `groundwork-payment-sandbox-isolated`.

## Confirmed via founder's Cloudflare screenshots (same Worker)
| Item | Observed | Confidence |
| --- | --- | --- |
| Production workers.dev route | Enabled | Screenshot confirmed |
| Preview workers.dev URLs | Disabled | Screenshot confirmed |
| Custom domains / routes | None shown | Screenshot confirmed |
| Cloudflare Worker-level Access | **All traffic** | Screenshot confirmed |
| Access Allow policy | **Groundwork Owner Only**; exact single founder email | Screenshot confirmed |
| Production identity binding names | `FOUNDER_ACCESS_AUD`, `FOUNDER_ACCESS_EMAIL` | Screenshot confirmed |
| **Production bindings inventory** | **No connected bindings** displayed | Settings → Bindings screenshot, November 15, 2026 |
| **Production variables inventory** | Exactly two entries displayed: `FOUNDER_ACCESS_AUD` and `FOUNDER_ACCESS_EMAIL`, both Type `Variable` | Settings → Runtime variables and secrets screenshot; AUD deliberately redacted |
| **Observability logging** | Logs enabled; invocation logs and dashboard persistence checked | Settings → Observability screenshot |
| **Active deployment version** | **`1f97ea8e` at 100% traffic** | Deployments screenshot, November 15, 2026; short UI ID only |
| **Production compatibility date** | **`2026-11-15`** | Settings → Runtime screenshot, November 15, 2026; matches proposed candidate |
| **Compatibility flags** | No flags shown; field displays placeholder | Screenshot confirms none listed, not an independent API query |
| **Runtime placement** | `Default` | Screenshot confirmed |
| **Runtime cache** | `Disabled` | Screenshot confirmed |
| Earlier deployment entries | `e8cdb15e`, `1801d112` shown as Ready | Historical UI entries, not proven complete rollback copies |
| Active version description | `Add variable: FOUNDER_ACCESS_AUD FOUNDER_ACCESS...` (truncated) | Dashboard description; do not infer full contents |
| Traffic metrics at capture | 0 req/sec, 0% error rate | Dashboard snapshot only; does not prove access denial or runtime safety |
| Actual Access AUD/JWKS | Deliberately redacted | Must not be pasted or saved in GitHub |
| Separate Worker bootstrap response | `Founder service disabled` (503) | Previously founder browser-tested; not re-tested in this checkpoint |

## Still unknown / blocking (do not infer)
| Field | Why needed | Safe read-only dashboard location |
| --- | --- | --- |
| **Full immutable active version ID and confirmation of rollback eligibility** | Screenshot shows short ID `1f97ea8e` serving 100%; confirm full version identifier and contents before planning a rollback | Worker → **Deployments** → active entry / version details, read-only |
| **Independent compatibility/config reconciliation** | Date `2026-11-15`, flags blank, placement Default, cache Disabled were screenshot-confirmed; verify the proposed upload preserves those as well as other deploy-version settings | Worker Settings → Runtime plus prospective version review; NO upload yet |
| **Independent pre-upload preservation verification** | Dashboard screenshot shows only the two founder identity variables and **no connected bindings**; inspect any Cloudflare version-change preview before approval for silent changes | Future review gate; no upload or deployment authorized |
| **Exact current Access AUD matches stored variable** | The name being present is not evidence its value is correct | Compare privately inside Cloudflare; **do not post values** |
| **Wrong-account denial and versioned rollback behavior** | Verify security and recovery independently | Separately approved testing and rollback plan; do not attempt yet |

Cloudflare documents that a version captures code, bindings, and compatibility settings, while a deployment selects the version serving traffic. Recording the active **version ID** is therefore prerequisite to a reversible code replacement. A rollback can redeploy a previous version at 100%, but it does not revert data in separate storage resources.

References:
- https://developers.cloudflare.com/workers/versions-and-deployments/
- https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- https://developers.cloudflare.com/workers/configuration/compatibility-dates/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/

## Candidate under review — NOT EXECUTABLE AUTHORIZATION
`wrangler.founder-notification.preservation-candidate.toml` has `workers_dev=true`, `preview_urls=false`, `keep_vars=true`, no direct Access AUD/email values, no D1 bindings, and nine disabled operator/payment/send gates. It is a *proposed* configuration, not an exact replay of live state. `keep_vars` is only a variable preservation option; it does not prove Access policy, route or compatibility preservation.

If the currently deployed compatibility date/flags differ, **STOP** and reconcile the candidate before even considering a version upload. If any binding or variable name/type differs, **STOP**. Do not use the pre-Access `wrangler.founder-notification.draft.toml`: its `workers_dev=false` would conflict with the enabled production workers.dev URL observed in screenshots.

### Required release decision, later
- New, explicit founder authorization with named Worker, reviewed artifact hash, exact deployment/update mechanism, active version ID rollback target and disabled gate settings.
- Verify no Cloudflare account token or environment value is disclosed in GitHub or chat.
- Prior to any live replacement, verify existing Access route denies unauthenticated requests and known-good 503 response remains.
- After any separately approved replacement: test Access and unchanged routing; disabled status/review/dispatch; no D1, Stripe, Resend, webhook or public checkout exposure; restore original version immediately if any mismatch.
- No *upload*, deploy, Worker route edit, Access policy edit, secret creation or data change has been authorized by this checkpoint.

**Read-only Cloudflare dashboard inventory COMPLETE for the currently viewed production settings.** The next work is desk review of the exact script upload/versioning procedure and preservation of the protected workers.dev route, Access app, variables, runtime configuration and rollback. Do not ask founder to re-send the same screenshots. Separate approval is required before any Cloudflare mutation; runtime policy behavior, full active version ID, Access AUD value equality and wrong-account denial remain unverified.
