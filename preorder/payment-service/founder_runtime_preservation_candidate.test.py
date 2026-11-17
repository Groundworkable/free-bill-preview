"""Review-only, offline safety checks for the Cloudflare founder runtime candidate.

No Wrangler upload, Cloudflare API, database, Stripe or Resend calls.
Do not treat passing tests as authorization to update a Worker.
"""
from pathlib import Path
import copy
import tomllib

ROOT = Path(__file__).resolve().parent
CANDIDATE = ROOT / "wrangler.founder-notification.preservation-candidate.toml"
PRE_ACCESS = ROOT / "wrangler.founder-notification.draft.toml"
SOURCE = ROOT / "founder_notification_worker.draft.mjs"
ORIGINAL_BOOTSTRAP = ROOT / "founder_notification_bootstrap.disabled.mjs"

EXPECTED_CLOSED_VARS = {
    "FOUNDER_NOTIFICATION_ADMIN_MODE": "disabled",
    "FOUNDER_NOTIFICATION_REVIEW_ENABLED": "false",
    "FOUNDER_NOTIFICATION_DISPATCH_ENABLED": "false",
    "NOTIFICATION_SEND_MODE": "disabled",
    "NOTIFICATION_OPERATOR_RELEASE": "false",
    "NOTIFICATION_TEMPLATES_APPROVED": "false",
    "PAYMENTS_MODE": "disabled",
    "TERMS_APPROVED": "false",
    "TERMS_VERSION": "UNAPPROVED",
}
EXPECTED_TOP_LEVEL = {
    "name", "main", "compatibility_date", "workers_dev",
    "preview_urls", "keep_vars", "vars",
}

def validate(config):
    assert set(config) == EXPECTED_TOP_LEVEL, (
        "Unexpected or missing top-level Worker setting: "
        + repr(set(config) ^ EXPECTED_TOP_LEVEL)
    )
    assert config["name"] == "groundwork-founder-notifications-isolated"
    assert config["main"] == "./founder_notification_worker.draft.mjs"
    assert config["compatibility_date"] == "2026-11-15", (
        "Review current live compatibility date before any future upload"
    )
    assert config["workers_dev"] is True, "Protected production workers.dev URL must stay on"
    assert config["preview_urls"] is False, "Version/preview URLs must remain disabled"
    assert config["keep_vars"] is True, "Dashboard identity vars must be preserved"
    assert config["vars"] == EXPECTED_CLOSED_VARS, "Operational gates must stay off"
    assert not set(config["vars"]) & {
        "FOUNDER_ACCESS_AUD", "FOUNDER_ACCESS_EMAIL", "DB",
        "RESEND_API_KEY", "STRIPE_TEST_SECRET_KEY",
        "NOTIFICATION_REVIEW_SEAL_SECRET", "NOTIFICATION_RECIPIENT_HMAC_SECRET",
    }, "No dashboard identity values or privileged credentials allowed"

with CANDIDATE.open("rb") as f:
    config = tomllib.load(f)
validate(config)

with PRE_ACCESS.open("rb") as f:
    pre_access = tomllib.load(f)
assert pre_access["workers_dev"] is False, "Do not silently rewrite original preparation scaffold"
assert pre_access["name"] == config["name"]
assert SOURCE.is_file() and ORIGINAL_BOOTSTRAP.is_file()
source = SOURCE.read_text(encoding="utf8")
bootstrap = ORIGINAL_BOOTSTRAP.read_text(encoding="utf8")
assert "createFounderNotificationWorker" in source
assert 'url.pathname === "/founder/notifications/status"' in source
assert 'url.pathname === "/founder/notifications/review"' in source
assert 'url.pathname === "/founder/notifications/dispatch"' in source
assert 'url.pathname === "/__test/' not in source
assert "Founder service disabled" in bootstrap and "status: 503" in bootstrap

# Regression checks: deliberate unsafe edits must fail validation.
for field, bad in (
    ("workers_dev", False),
    ("preview_urls", True),
    ("keep_vars", False),
    ("name", "groundwork-payment-sandbox-isolated"),
):
    changed = copy.deepcopy(config)
    changed[field] = bad
    try:
        validate(changed)
    except AssertionError:
        pass
    else:
        raise AssertionError(f"Unsafe candidate {field}={bad!r} passed guard")

for field, bad in (
    ("FOUNDER_NOTIFICATION_ADMIN_MODE", "sandbox_access_only"),
    ("NOTIFICATION_SEND_MODE", "sandbox_founder_test"),
    ("PAYMENTS_MODE", "sandbox"),
):
    changed = copy.deepcopy(config)
    changed["vars"][field] = bad
    try:
        validate(changed)
    except AssertionError:
        pass
    else:
        raise AssertionError(f"Unsafe candidate gate {field} passed guard")

changed = copy.deepcopy(config)
changed["d1_databases"] = [{"binding": "DB", "database_id": "not-real"}]
try:
    validate(changed)
except AssertionError:
    pass
else:
    raise AssertionError("Unexpected D1 binding passed preservation gate")

print("PASS: offline founder runtime preservation candidate is closed, route-safe, and variable-preserving by configuration")
print("NOTE: Cloudflare remote state, live compatibility settings, Access AUD equality and deploy behavior remain unverified")
