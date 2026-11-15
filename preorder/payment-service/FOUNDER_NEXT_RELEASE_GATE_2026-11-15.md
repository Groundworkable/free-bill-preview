# Founder notification Worker — next actual Cloudflare step

Scope: only the existing groundwork-founder-notifications-isolated Worker, not the payment receiver or website.

Known active version: 1f97ea8e-4ba6-47d9-87f6-11594c938cc1 at 100% in the founder's Cloudflare screenshot.
Production workers.dev enabled, previews disabled, owner-only Access All traffic.
Existing identity variables FOUNDER_ACCESS_AUD and FOUNDER_ACCESS_EMAIL; no connected bindings; compatibility 2026-11-15.

Local CI completed the exact Wrangler version-upload dry run with all nine operational gates disabled, no database binding, and no send, review, payment or public checkout activation.

## One authenticated read-only operation

Run from the checkout of this PR in an already authenticated founder-owned terminal:

    python3 preorder/payment-service/founder_cloudflare_readonly_preflight.py --check

The command invokes only pinned Wrangler 4.162.0 versions view and deployments list, compares version/compatibility and 100% traffic, and prints a sanitized PASS or UNVERIFIED. Raw metadata is never printed or saved. No upload or deploy operation exists in the script.

If UNVERIFIED, STOP. A passing result is not proof of Access AUD equality or rollback and is not permission to deploy.

## Next separate decision (not performed)

Only after the read-only preflight and confirming AUD privately may a separately authorized, inactive version upload be considered. Cloudflare's versions upload supports creating a new Worker version without directing production traffic to it. Strict and keep-vars are required to preserve dashboard-managed variables. Check the exact commit, review artifact checksum and current production version before any account mutation.

No live Worker change, no Stripe/Resend activation, no webhook enablement, no merge, and no public checkout opening are authorized by this document.

References: https://developers.cloudflare.com/workers/versions-and-deployments/ and https://developers.cloudflare.com/workers/wrangler/commands/workers/