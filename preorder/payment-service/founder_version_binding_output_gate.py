"""Verify *reported* Wrangler version-upload dry-run bindings, OFFLINE ONLY.

This validates CLI-local output. It cannot show dashboard-managed vars or
prove how Cloudflare would merge them on a real upload. Never invoke a live
Cloudflare upload or include credentials in the CI job.
"""
from pathlib import Path
import re

EXPECTED = {
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

ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*m")
ROW = re.compile(r'^env\.([A-Z][A-Z0-9_]*)\s+\("([^"]*)"\)\s+Environment Variable\s*$')
RESOURCE = re.compile(r"^env\.")

def validate(text: str):
    lines = ANSI_ESCAPE.sub("", text).splitlines()
    assert any("Your Worker has access to the following bindings:" in x for x in lines), (
        "No Wrangler binding summary found"
    )
    assert any("--dry-run: exiting now." in x for x in lines), (
        "Missing proof that Wrangler stopped before remote upload"
    )
    bindings = {}
    for line in lines:
        stripped = line.strip()
        if not RESOURCE.match(stripped):
            continue
        matched = ROW.fullmatch(stripped)
        assert matched, "Unexpected runtime binding type or format: " + stripped
        key, value = matched.groups()
        assert key not in bindings, "Duplicate binding: " + key
        bindings[key] = value
    assert bindings == EXPECTED, (
        "Wrangler dry-run reported an unexpected binding set or an enabled gate; "
        "expected only nine disabled values"
    )
    return bindings

def test_rejections():
    rows = "".join(f'env.{k} ("{v}")  Environment Variable\n' for k, v in EXPECTED.items())
    valid = "Your Worker has access to the following bindings:\n" + rows + "--dry-run: exiting now.\n"
    assert validate(valid) == EXPECTED
    for corrupted in (
        valid.replace('env.PAYMENTS_MODE ("disabled")', 'env.PAYMENTS_MODE ("sandbox")'),
        valid.replace('--dry-run: exiting now.', ''),
        valid + 'env.DB  D1 Database\n',
        valid + 'env.STRIPE_API_KEY ("not-a-secret") Environment Variable\n',
        valid + rows.splitlines()[0] + "\n",
    ):
        try:
            validate(corrupted)
        except AssertionError:
            pass
        else:
            raise AssertionError("Unsafe Wrangler dry-run bindings were accepted")

if __name__ == "__main__":
    test_rejections()
    log = Path(__file__).resolve().parent / ".founder-version-upload-dry-run.log"
    assert validate(log.read_text(encoding="utf-8")) == EXPECTED
    print("PASS: Wrangler dry-run lists exactly nine disabled variables and no DB, secrets or service bindings")
    print("NOTE: this is offline CLI evidence; Cloudflare dashboard variables and Access settings are NOT validated")
