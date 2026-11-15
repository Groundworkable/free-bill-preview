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
| Actual Access AUD/JWKS | Deliberately redacted | Must not be pasted or saved in GitHub |
| Separate Worker bootstrap response | `Founder service disabled` (503) | Previously founder browser-tested; not re-tested in this checkpoint |

## Still unknown / blocking (do not infer)
| Field | Why needed | Safe read-only dashboard location |
| --- | --- | --- |
| **Current active deployment version ID** and traffic percentage | Anchor known-good rollback; distinguish uploaded versions from active deployment | Worker → **Deployments**; inspect current active entry, without selecting Deploy or Rollback |
| **Current compatibility date and compatibility flags** | Avoid accidental runtime behavior change from candidate date `2026-11-15` | Worker → **Settings** → Runtime / Compatibility settings (dashboard UI label may vary) |
| **All current bindings and variables (names/types only)** | Ensure candidate does not remove service bindings, secrets or other production config | Worker → Settings → Bindings, Variables and Secrets; **redact all values** |
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

**Next founder input (one screenshot only):** open **Cloudflare → Workers & Pages → groundwork-founder-notifications-isolated → Deployments** and send the current active deployment entry, including its visible version ID and traffic share. No controls should be clicked beyond navigating.
