#!/usr/bin/env python3
"""Fail closed if this review workflow gains a Cloudflare upload/deploy path.

Static regression guard, not a general shell/YAML security analyzer. This
script is run before any Wrangler command in the review-only CI job.

No Cloudflare credentials, live mutations, external network calls or secrets.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/prepurchase-notification-ci.yml"

APPROVED_WRANGLER_LINES = {
    "npx wrangler deploy ./founder_notification_worker.draft.mjs "
    "--name groundwork-founder-notifications-isolated --dry-run "
    "--outdir ./.founder-runtime-build --compatibility-date 2026-11-15",
    "npx wrangler versions upload "
    "--config ./wrangler.founder-notification.preservation-candidate.toml "
    "--dry-run --keep-vars --strict "
    "--outdir ./.founder-version-preservation-dry-run "
    "2>&1 | tee .founder-version-upload-dry-run.log",
}


def validate(text: str) -> None:
    assert text.count("\npermissions:\n  contents: read\n") == 1, (
        "Workflow permissions must be explicitly read-only"
    )
    assert not re.search(r"\b(?:contents|id-token|deployments|packages|actions):\s*write\b", text), (
        "Unexpected elevated GitHub workflow permissions"
    )
    assert not re.search(r"\bsecrets\s*\.|\bvars\s*\.", text), (
        "Do not reference GitHub secret/variable contexts in this review workflow"
    )
    assert text.count('          CLOUDFLARE_API_TOKEN: ""') == 1
    assert text.count('          CLOUDFLARE_ACCOUNT_ID: ""') == 1

    # No other Cloudflare account credentials may be passed into this workflow.
    for key in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"):
        assert text.count(key) == 1, "Unexpected Cloudflare credential reference"

    actual = []
    for line in text.splitlines():
        command = line.strip()
        # Exact allowlist of EVERY Wrangler command in this workflow.
        if re.search(r"\bwrangler\s+(?:deploy|versions|deployments|secret|kv|d1|r2|whoami)\b", command, re.I):
            assert command in APPROVED_WRANGLER_LINES, (
                "Unexpected Wrangler command in review-only workflow"
            )
            actual.append(command)

    assert len(actual) == 2 and set(actual) == APPROVED_WRANGLER_LINES, (
        "Expected both reviewed, credential-free Wrangler dry-run commands only"
    )
    assert all("--dry-run" in command for command in actual)
    assert "python3 preorder/payment-service/founder_ci_no_deploy_guard.py" in text


def self_test(original: str) -> None:
    validate(original)
    for changed in (
        original.replace("--dry-run --outdir ./.founder-runtime-build", "--outdir ./.founder-runtime-build"),
        original.replace("versions upload --config", "versions deploy --config"),
        original.replace("groundwork-founder-notifications-isolated --dry-run",
                         "groundwork-payment-sandbox-isolated --dry-run"),
        original.replace('CLOUDFLARE_API_TOKEN: ""',
                         "CLOUDFLARE_API_TOKEN: ${{ secrets.CF_TOKEN }}"),
        original.replace("  contents: read", "  contents: write"),
        original + "\n      - name: Unauthorized CLI\n        run: npx wrangler deploy other.mjs\n",
    ):
        assert changed != original, "Failed to create negative fixture"
        try:
            validate(changed)
        except AssertionError:
            pass
        else:
            raise AssertionError("Unsafe synthetic workflow change passed the review-only guard")


if __name__ == "__main__":
    contents = WORKFLOW.read_text(encoding="utf-8")
    self_test(contents)
    print("PASS: CI has only approved Wrangler dry runs, empty Cloudflare credentials and read-only GitHub permissions")
    print("LIMITATION: static workflow regression guard; does not inspect all repo workflows or Cloudflare deployment settings")
