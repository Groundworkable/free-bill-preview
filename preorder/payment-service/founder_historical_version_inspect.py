#!/usr/bin/env python3
"""Read-only historical Cloudflare Worker version integrity check.

Tests Cloudflare's *specific historical version* against the exact bundled
JavaScript SHA-256 reported by Groundwork PR #17 CI. Also checks version
bindings and confirms the original known-good version still receives all
production traffic.

--check does only two Cloudflare GET requests. No deploy/upload/rollback,
no D1 write, and no Stripe/Resend actions. Requires owner-controlled shell
with CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN set privately.
Never paste tokens, raw version JSON, modules, or identity values into chat.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

WORKER = "groundwork-founder-notifications-isolated"
HISTORY = "22367a82-2713-4f1f-b927-65301fe75a17"
RESTORED = "1f97ea8e-4ba6-47d9-87f6-11594c938cc1"
BUNDLE_SHA256 = "63282db30b16f3ed46a1ac0dfd1c8a5e6702a759a88bb93d7404e1ab74330f8d"
COMPAT_DATE = "2026-11-15"
IDENTITY = {"FOUNDER_ACCESS_AUD", "FOUNDER_ACCESS_EMAIL"}
CLOSED = {
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


class Unverified(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def _result(data):
    if not isinstance(data, dict) or data.get("success") is not True:
        raise Unverified
    result = data.get("result")
    if not isinstance(result, dict):
        raise Unverified
    return result


def inspect(version_response, deployments_response, expected_hash=BUNDLE_SHA256):
    version = _result(version_response)
    if version.get("id") != HISTORY:
        raise Unverified

    if version.get("compatibility_date") != COMPAT_DATE:
        raise Unverified
    if version.get("compatibility_flags", []) != []:
        raise Unverified

    bindings = version.get("bindings")
    if not isinstance(bindings, list):
        raise Unverified
    seen = {}
    for binding in bindings:
        if not isinstance(binding, dict):
            raise Unverified
        name, kind = binding.get("name"), binding.get("type")
        if name in seen or name not in (IDENTITY | set(CLOSED)):
            raise Unverified
        if kind != "plain_text":
            raise Unverified
        if name in CLOSED and binding.get("text") != CLOSED[name]:
            raise Unverified
        if name in IDENTITY and (
            not isinstance(binding.get("text"), str) or not binding["text"]
        ):
            raise Unverified
        seen[name] = kind
    if not IDENTITY.issubset(seen):
        raise Unverified
    # Operational flags may be absent on manual dashboard deployments.
    # Their absence is fail-closed in the tested JS. Any present flags must
    # be OFF. No DB, provider secrets, service or other bindings allowed.

    modules = version.get("modules")
    if not isinstance(modules, list) or len(modules) != 1:
        raise Unverified
    module = modules[0]
    if not isinstance(module, dict) or module.get("content_type") not in (
        "application/javascript+module", "application/javascript",
        "text/javascript", "application/x-javascript",
    ):
        raise Unverified
    encoded = module.get("content_base64")
    if not isinstance(encoded, str):
        raise Unverified
    try:
        code = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise Unverified
    if len(code) < 1000 or len(code) > 8 * 1024 * 1024:
        raise Unverified
    if hashlib.sha256(code).hexdigest() != expected_hash:
        raise Unverified

    deployments = _result(deployments_response).get("deployments")
    if not isinstance(deployments, list) or not deployments:
        raise Unverified
    # Cloudflare documents the first result as the current live deployment.
    current = deployments[0]
    if not isinstance(current, dict):
        raise Unverified
    versions = current.get("versions")
    if not isinstance(versions, list) or len(versions) != 1:
        raise Unverified
    traffic = versions[0]
    if not isinstance(traffic, dict) or traffic.get("version_id") != RESTORED:
        raise Unverified
    pct = traffic.get("percentage")
    if type(pct) not in (int, float) or pct != 100:
        raise Unverified
    return True


def get_json(url, token):
    # No external redirect may receive the bearer token.
    request = urllib.request.Request(
        url, method="GET",
        headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
    )
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
            raw = response.read(12 * 1024 * 1024 + 1)
    except (OSError, urllib.error.URLError, TimeoutError):
        raise Unverified
    if len(raw) > 12 * 1024 * 1024:
        raise Unverified
    try:
        return json.loads(raw)
    except (UnicodeError, ValueError):
        raise Unverified


def check():
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    if len(account) != 32 or any(c not in "0123456789abcdefABCDEF" for c in account) or not token:
        print("UNVERIFIED: use an existing owner-controlled account ID and read-only API token privately")
        return 1
    base = "https://api.cloudflare.com/client/v4/accounts/" + account
    worker_path = urllib.parse.quote(WORKER, safe="")
    try:
        historical_url = (base + "/workers/workers/" + worker_path
            + "/versions/" + HISTORY + "?include=modules")
        deployments_url = base + "/workers/scripts/" + worker_path + "/deployments"
        inspect(get_json(historical_url, token), get_json(deployments_url, token))
    except Unverified:
        print("UNVERIFIED: historical source/bindings or current traffic differ or read failed")
        print("STOP: do not promote or deploy the historical version")
        print("No version source, account settings, or identity values were printed")
        return 1
    print("PASS: historical version code SHA256 exactly matches GitHub CI review bundle")
    print("PASS: only founder identity and absent-or-disabled operational bindings are present")
    print("PASS: original 1f97ea8e version remains at 100% live traffic")
    print("LIMIT: Worker-level Access policy, wrong-account denial and future safety still require review")
    print("READ ONLY: no Cloudflare changes made")
    return 0


def self_test():
    code = b"// synthetic Worker module\n" + b"x" * 1200
    hash_value = hashlib.sha256(code).hexdigest()
    version = {"success": True, "result": {
        "id": HISTORY,
        "compatibility_date": COMPAT_DATE,
        "compatibility_flags": [],
        "bindings": [
            {"name":"FOUNDER_ACCESS_AUD","type":"plain_text","text":"synthetic-audience"},
            {"name":"FOUNDER_ACCESS_EMAIL","type":"plain_text","text":"synthetic@example.invalid"},
        ],
        "modules":[{"name":"index.js","content_type":"application/javascript+module",
                    "content_base64":base64.b64encode(code).decode()}]
    }}
    deployments = {"success":True,"result":{"deployments":[{
        "versions":[{"version_id":RESTORED,"percentage":100}]
    }]}}
    import copy
    assert inspect(version, deployments, hash_value)
    tests = []
    v=copy.deepcopy(version);v["result"]["id"]="wrong";tests.append((v, deployments))
    v=copy.deepcopy(version);v["result"]["bindings"].append(
        {"name":"DB","type":"d1","id":"fake"});tests.append((v,deployments))
    v=copy.deepcopy(version);v["result"]["bindings"].append(
        {"name":"NOTIFICATION_SEND_MODE","type":"plain_text","text":"sandbox_founder_test"})
    tests.append((v,deployments))
    v=copy.deepcopy(version);v["result"]["modules"][0]["content_base64"] = base64.b64encode(code+b"changed").decode()
    tests.append((v,deployments))
    v=copy.deepcopy(version);v["result"]["modules"].append(v["result"]["modules"][0]);tests.append((v,deployments))
    d=copy.deepcopy(deployments);d["result"]["deployments"][0]["versions"][0]["percentage"]=50
    tests.append((version,d))
    d=copy.deepcopy(deployments);d["result"]["deployments"][0]["versions"][0]["version_id"]=HISTORY
    tests.append((version,d))
    d=copy.deepcopy(deployments);d["result"]["deployments"][0]["versions"].append(
        {"version_id":HISTORY,"percentage":0})
    tests.append((version,d))
    for v,d in tests:
        try:
            inspect(v,d,hash_value)
        except Unverified:
            continue
        raise AssertionError("Unsafe synthetic historical version was accepted")
    print("PASS: synthetic code SHA, identity/closed bindings and original 100% traffic checks")
    print("LIMIT: no live Cloudflare account was accessed")


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    elif sys.argv[1:] == ["--check"]:
        sys.exit(check())
    else:
        print("Usage: --self-test | --check (Cloudflare read-only)")
        sys.exit(2)
