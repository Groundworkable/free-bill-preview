#!/usr/bin/env python3
"""Validate an existing Worker version without revealing its metadata.

The schema follows Cloudflare Wrangler 4.162.0's versions/view.ts:
`versions view --json` emits the version object directly, with the
compatibility settings under `resources.script_runtime` and the bindings
under `resources.bindings`. This tool makes NO Cloudflare API call.

Only use locally with an already authenticated owner-controlled terminal:
  npx wrangler@4.162.0 versions view \
    1f97ea8e-4ba6-47d9-87f6-11594c938cc1 \
    --name groundwork-founder-notifications-isolated --json \
    | python3 founder_version_metadata_redact.py

NEVER paste raw JSON, audience values or credentials into chat/GitHub/CI.
The tool prints only fixed PASS/UNVERIFIED messages and writes no files.
"""
import json
import sys

# Cloudflare Wrangler 4.162.0 source, not a guess about the output schema:
# https://github.com/cloudflare/workers-sdk/blob/wrangler%404.162.0/packages/wrangler/src/versions/view.ts
ACTIVE_VERSION = "1f97ea8e-4ba6-47d9-87f6-11594c938cc1"
EXPECTED_BINDINGS = {"FOUNDER_ACCESS_AUD", "FOUNDER_ACCESS_EMAIL"}
EXPECTED_DATE = "2026-11-15"
EXPECTED_TYPE = "plain_text"  # Dashboard showed both as Variable, not Secret


class Unverified(Exception):
    pass


def inspect(data):
    if not isinstance(data, dict) or data.get("id") != ACTIVE_VERSION:
        raise Unverified
    resources = data.get("resources")
    if not isinstance(resources, dict):
        raise Unverified
    runtime = resources.get("script_runtime")
    if not isinstance(runtime, dict):
        raise Unverified
    if runtime.get("compatibility_date") != EXPECTED_DATE:
        raise Unverified
    # Cloudflare's optional compatibility_flags may be absent for no flags.
    if runtime.get("compatibility_flags", []) != []:
        raise Unverified
    bindings = resources.get("bindings")
    if not isinstance(bindings, list):
        raise Unverified
    names = []
    for binding in bindings:
        if not isinstance(binding, dict):
            raise Unverified
        if binding.get("name") not in EXPECTED_BINDINGS:
            raise Unverified
        if binding.get("type") != EXPECTED_TYPE:
            raise Unverified
        names.append(binding["name"])
    if len(names) != 2 or set(names) != EXPECTED_BINDINGS:
        raise Unverified
    return True


def self_test():
    # Matches the *structural shape* returned by Wrangler 4.162.0.
    # All values below are synthetic; real Cloudflare metadata is NOT fetched.
    fake = {
        "id": ACTIVE_VERSION,
        "metadata": {"created_on": "2026-11-15T00:00:00Z"},
        "resources": {
            "script": {"handlers": ["fetch"]},
            "script_runtime": {
                "compatibility_date": EXPECTED_DATE,
                "compatibility_flags": [],
            },
            "bindings": [
                {"name": "FOUNDER_ACCESS_AUD", "type": "plain_text", "text": "fake-do-not-print"},
                {"name": "FOUNDER_ACCESS_EMAIL", "type": "plain_text", "text": "private@example.invalid"},
            ],
        },
    }
    import copy
    assert inspect(fake)
    absent_flags = copy.deepcopy(fake)
    del absent_flags["resources"]["script_runtime"]["compatibility_flags"]
    assert inspect(absent_flags)

    unsafe = []
    for key, value in (
        ("id", "wrong-version"),
        ("resources", None),
        ("compatibility_date", "2026-11-14"),
        ("compatibility_flags", ["no_nodejs_compat"]),
        ("bindings", []),
        ("bindings", fake["resources"]["bindings"][:1]),
        ("bindings", fake["resources"]["bindings"] * 2),
        ("bindings", fake["resources"]["bindings"] + [{"name": "DB", "type": "d1", "id": "fake"}]),
        ("bindings", [{"name": "FOUNDER_ACCESS_AUD", "type": "secret_text"},
                       fake["resources"]["bindings"][1]]),
    ):
        obj = copy.deepcopy(fake)
        if key == "id":
            obj["id"] = value
        elif key == "resources":
            obj["resources"] = value
        elif key in ("compatibility_date", "compatibility_flags"):
            obj["resources"]["script_runtime"][key] = value
        else:
            obj["resources"]["bindings"] = value
        unsafe.append(obj)
    unsafe.extend([
        # The old speculative flat schema must NOT pass.
        {"id": ACTIVE_VERSION, "compatibility_date": EXPECTED_DATE,
         "compatibility_flags": [], "bindings": fake["resources"]["bindings"]},
        {"result": fake}, {"version": fake}, [fake], {"value": "fake-do-not-print"},
    ])
    for bad in unsafe:
        try:
            inspect(bad)
        except Unverified:
            continue
        raise AssertionError("Unexpected Worker version data passed strict validation")
    print("PASS: synthetic Wrangler 4.162.0 nested metadata shape and fail-closed mutations")
    print("LIMITATION: Cloudflare live version metadata was not fetched")


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        return 0
    if len(sys.argv) != 1:
        print("UNVERIFIED: unsupported invocation; no data printed")
        return 1
    try:
        inspect(json.load(sys.stdin))
    except (Unverified, ValueError, TypeError, UnicodeError):
        print("UNVERIFIED: metadata structure or release invariants did not match")
        print("No raw Cloudflare metadata was printed or saved")
        return 1
    print("PASS: current Worker version ID, compatibility date and absence of flags match")
    print("PASS: exactly two expected founder identity Variables; no other bindings")
    print("LIMITATION: Access policy, route state, active traffic and rollback are NOT verified")
    return 0


if __name__ == "__main__":
    sys.exit(main())
