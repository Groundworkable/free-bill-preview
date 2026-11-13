"""Enforce isolation and no-deploy defaults for the Groundwork payment sandbox."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
service = root / "preorder" / "payment-service"
config_path = service / "wrangler.sandbox.example.jsonc"
raw = config_path.read_text(encoding="utf-8")
# Parse the JSONC example without fetching extra dependencies.
without_comments = "\n".join(line for line in raw.splitlines() if not line.lstrip().startswith("//"))
cfg = json.loads(without_comments)
assert cfg["name"] == "groundwork-payment-sandbox-isolated"
assert cfg["main"] == "./worker.mjs"
assert cfg["workers_dev"] is False
assert cfg["routes"] == []
assert cfg["vars"]["PAYMENTS_MODE"] == "disabled"
assert cfg["d1_databases"][0]["database_name"] == "groundwork-payment-sandbox-isolated"
assert cfg["d1_databases"][0]["database_id"] == "REPLACE_WITH_NEW_ISOLATED_D1_UUID"
assert not (service / "wrangler.toml").exists()
assert not (service / "wrangler.json").exists()
assert not (service / "wrangler.jsonc").exists()
assert "sk_test_" not in raw and "sk_live_" not in raw and "whsec_" not in raw
workflow = (root / ".github/workflows/public-site-qa.yml").read_text(encoding="utf-8").lower()
assert not any(command in workflow for command in (
    "wrangler deploy", "cloudflare/wrangler-action", "npx wrangler deploy",
    "npm run deploy", "pnpm deploy", "yarn deploy"
))
print("PASS: payment sandbox is nondeployable, disabled, and bound to no existing app")
