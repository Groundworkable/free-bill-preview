#!/usr/bin/env python3
"""Safe *local* review of a Cloudflare Worker version JSON document.

Accepts JSON from stdin and emits only a FIXED, tightly scoped PASS/UNVERIFIED
summary. Never prints the raw input, arbitrary fields, variable names outside
a hardcoded allowlist, variable contents, account IDs, or credentials.

This does NOT authenticate or call Cloudflare; it only validates the shape
of version metadata provided by the operator. Only useful if an authenticated
read-only 'wrangler versions view --json' command yields the expected fields.
Fail closed on unknown structure. No data is written to disk.

Usage in a previously authenticated, owner-controlled shell ONLY:
  npx wrangler@4.162.0 versions view \
    1f97ea8e-4ba6-47d9-87f6-11594c938cc1 \
    --name groundwork-founder-notifications-isolated --json \
    | python3 founder_version_metadata_redact.py

Do not post the JSON itself; it could contain variable values.
"""
import json
import re
import sys

ACTIVE_VERSION = "1f97ea8e-4ba6-47d9-87f6-11594c938cc1"
EXPECTED_BINDINGS = {"FOUNDER_ACCESS_AUD", "FOUNDER_ACCESS_EMAIL"}
EXPECTED_DATE = "2026-11-15"
SAFE_VARIABLE_TYPES = {"plain_text", "secret_text"}


class Unverified(Exception):
    pass


def root_version(data):
    if not isinstance(data, dict):
        raise Unverified
    # Wrangler's output schema may vary. Interpret only explicit known wrappers.
    obj = data
    for _ in range(2):
        if "result" in obj and isinstance(obj["result"], dict):
            obj = obj["result"]
        elif "version" in obj and isinstance(obj["version"], dict):
            obj = obj["version"]
        else:
            break
    return obj


def inspect(data):
    obj = root_version(data)
    supplied_id = obj.get("id", obj.get("version_id"))
    if supplied_id != ACTIVE_VERSION:
        raise Unverified
    if obj.get("compatibility_date") != EXPECTED_DATE:
        raise Unverified
    flags = obj.get("compatibility_flags")
    if flags != []:
        raise Unverified
    bindings = obj.get("bindings")
    if not isinstance(bindings, list):
        raise Unverified

    names = []
    for b in bindings:
        if not isinstance(b, dict):
            raise Unverified
        name, kind = b.get("name"), b.get("type")
        if name not in EXPECTED_BINDINGS or kind not in SAFE_VARIABLE_TYPES:
            raise Unverified
        names.append(name)
    if len(names) != len(EXPECTED_BINDINGS) or len(set(names)) != len(names):
        raise Unverified
    return True


def self_test():
    # Synthetic data only. A fake variable payload must never be printed.
    obj = {
        "id": ACTIVE_VERSION,
        "compatibility_date": EXPECTED_DATE,
        "compatibility_flags": [],
        "bindings": [
            {"name": "FOUNDER_ACCESS_AUD", "type": "plain_text", "text": "sensitive-value-do-not-print"},
            {"name": "FOUNDER_ACCESS_EMAIL", "type": "plain_text", "text": "private@example.invalid"},
        ],
    }
    assert inspect(obj)
    assert inspect({"result": obj})
    assert inspect({"version": obj})

    for corrupt in (
        dict(obj, id="some-other-version"),
        dict(obj, compatibility_date="2026-11-14"),
        dict(obj, compatibility_flags=["dangerous_extra_flag"]),
        dict(obj, bindings=obj["bindings"][:1]),
        dict(obj, bindings=obj["bindings"] + [obj["bindings"][0]]),
        dict(obj, bindings=obj["bindings"] + [{"name": "DB", "type": "d1", "value": "secret"}]),
        dict(obj, bindings=None),
        {"value": "sensitive-value-do-not-print"},
        [obj],
    ):
        try:
            inspect(corrupt)
        except Unverified:
            pass
        else:
            raise AssertionError("Unsafe synthetic metadata was accepted")

    print("PASS: synthetic metadata sanitizer accepts only active version, exact compatibility, two identity variables, no extra bindings")
    print("LIMITATION: only synthetic data was inspected; no authenticated Cloudflare request occurred")


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        return 0
    if len(sys.argv) != 1:
        print("UNVERIFIED: unsupported invocation; no data printed")
        return 1
    try:
        data = json.load(sys.stdin)
        inspect(data)
    except (Unverified, ValueError, TypeError, UnicodeError):
        print("UNVERIFIED: metadata structure or required release invariants did not match")
        print("No raw Cloudflare metadata was printed or saved")
        return 1

    print("PASS: provided metadata matches the recorded active version UUID and compatibility date")
    print("PASS: exactly the two founder identity variable binding names and recognized variable types; no other bindings listed")
    print("LIMITATION: this does not prove Access policy, route preservation, rollback behavior or the live state of future uploads")
    return 0


if __name__ == "__main__":
    sys.exit(main())
