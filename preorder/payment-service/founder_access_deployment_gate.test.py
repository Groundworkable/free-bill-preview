"""Offline deployment guard for the separate, undeployed founder notification Worker.

A passing check DOES NOT authorize deployment, Cloudflare Access setup, provider
activation, or customer email. Run from the PR's notification-safe-tests CI.
"""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
config = (root / "wrangler.founder-notification.draft.toml").read_text(encoding="utf8")
worker = (root / "founder_notification_worker.draft.mjs").read_text(encoding="utf8")
public_worker = (root / "worker.mjs").read_text(encoding="utf8")
local_entry = (root / "worker.local.entry.mjs").read_text(encoding="utf8")

# Safety boundary: no public URL, preview, production route, bindings, or credentials.
for line in (
    'name = "groundwork-founder-notifications-isolated"',
    'main = "./founder_notification_worker.draft.mjs"',
    'workers_dev = false',
    'preview_urls = false',
    'FOUNDER_NOTIFICATION_ADMIN_MODE = "disabled"',
    'FOUNDER_NOTIFICATION_REVIEW_ENABLED = "false"',
    'FOUNDER_NOTIFICATION_DISPATCH_ENABLED = "false"',
    'NOTIFICATION_SEND_MODE = "disabled"',
    'NOTIFICATION_OPERATOR_RELEASE = "false"',
    'NOTIFICATION_TEMPLATES_APPROVED = "false"',
    'PAYMENTS_MODE = "disabled"',
    'TERMS_APPROVED = "false"',
    'TERMS_VERSION = "UNAPPROVED"',
):
    assert line in config, "Missing default-deny scaffold: " + line

for pattern in (r'^routes?\s*=', r'^\[\[routes?\]\]', r'^\[\[d1_databases\]\]',
                r'^FOUNDER_ACCESS_AUD\s*=', r'^FOUNDER_ACCESS_EMAIL\s*=',
                r'^RESEND_API_KEY\s*=', r'^STRIPE_TEST_SECRET_KEY\s*=',
                r'^NOTIFICATION_REVIEW_SEAL_SECRET\s*=',
                r'^NOTIFICATION_RECIPIENT_HMAC_SECRET\s*=',
                r'^\[build\]',r'^\[site\]'):
    assert not re.search(pattern,config,re.M), "Unexpected route/binding/secret in no-deploy config: "+pattern

# Never mistake an HTTP header, a cookie email, or request-supplied ID for identity.
assert 'ctx.access.aud !== env.FOUNDER_ACCESS_AUD' in worker
assert 'ctx.access.getIdentity()' in worker
assert 'normalizedEmail(identity?.email) === normalizedEmail(env.FOUNDER_ACCESS_EMAIL)' in worker
assert 'request.headers.get("Cf-Access-Jwt-Assertion")' not in worker
assert 'request.headers.get("Cf-Access-Authenticated-User-Email")' not in worker
assert 'await authenticate(env, ctx)' in worker

# The production payment Worker cannot accidentally expose the founder handler.
assert 'founder_notification_worker.draft.mjs' not in public_worker
assert 'worker.local.entry.mjs' not in worker
assert 'worker.local.entry.mjs' in local_entry or '/__test/' in local_entry
assert 'createFounderNotificationWorker' in worker
assert 'FOUNDER_NOTIFICATION_REVIEW_ENABLED !== "true"' in worker
assert 'FOUNDER_NOTIFICATION_DISPATCH_ENABLED === "true"' in worker
assert 'NOTIFICATION_SEND_MODE === "sandbox_founder_test"' in worker
assert '/__test/' not in worker
print("PASS: isolated founder Access scaffold has no routes or secrets and all gates default deny")
