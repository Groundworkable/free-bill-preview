#!/usr/bin/env python3
"""Strict, read-only founder Cloudflare Worker preflight. NEVER uploads/deploys.

Only versions view and deployments list are called in an already authenticated
owner environment. All raw JSON and stderr remain private in process memory.
Use --self-test for offline CI. Use --check for an authenticated remote read.
"""
from __future__ import annotations
from datetime import datetime
import json
from pathlib import Path
import subprocess
import sys
from founder_version_metadata_redact import inspect as inspect_version, Unverified as VersionUnverified

WORKER = "groundwork-founder-notifications-isolated"
CURRENT = "1f97ea8e-4ba6-47d9-87f6-11594c938cc1"
CLI = ["npx", "--yes", "wrangler@4.162.0"]
HERE = Path(__file__).resolve().parent

class Unverified(Exception):
    pass

def timestamp(value):
    if not isinstance(value, str):
        raise Unverified
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise Unverified from exc
    if dt.tzinfo is None:
        raise Unverified
    return dt

def check_deployments(data):
    if not isinstance(data, list) or not data or not all(isinstance(x, dict) for x in data):
        raise Unverified
    latest = max(data, key=lambda x: timestamp(x.get("created_on")))
    versions = latest.get("versions")
    if not isinstance(versions, list) or len(versions) != 1:
        raise Unverified
    active = versions[0]
    if not isinstance(active, dict) or active.get("version_id") != CURRENT:
        raise Unverified
    percent = active.get("percentage")
    if type(percent) not in (int, float) or percent != 100:
        raise Unverified
    return True

def validate(version, deployments):
    try:
        inspect_version(version)
        check_deployments(deployments)
    except VersionUnverified as exc:
        raise Unverified from exc
    return True

def command(args):
    try:
        result = subprocess.run(CLI + args, cwd=HERE, capture_output=True,
                                text=True, timeout=60, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise Unverified from exc
    if result.returncode:
        raise Unverified
    try:
        return json.loads(result.stdout)
    except ValueError as exc:
        raise Unverified from exc

def check():
    try:
        version = command(["versions", "view", CURRENT, "--name", WORKER, "--json"])
        deployments = command(["deployments", "list", "--name", WORKER, "--json"])
        validate(version, deployments)
    except Unverified:
        print("UNVERIFIED: remote Worker state differs, is unavailable, or auth failed")
        print("STOP: do not upload or deploy any Worker version")
        print("No raw metadata or credentials were printed or saved")
        return 1
    print("PASS: recorded original founder Worker version still receives 100% of traffic")
    print("PASS: original version date, flags, and identity binding names/types match")
    print("LIMIT: Access AUD equality, wrong-user denial, rollback and upload preservation not proved")
    print("No Cloudflare mutation was performed")
    return 0

def self_test():
    version = {
        "id": CURRENT,
        "resources": {
            "script_runtime": {"compatibility_date": "2026-11-15", "compatibility_flags": []},
            "bindings": [
                {"name":"FOUNDER_ACCESS_AUD","type":"plain_text","text":"never-print-this"},
                {"name":"FOUNDER_ACCESS_EMAIL","type":"plain_text","text":"fake@example.invalid"}
            ]
        }
    }
    deployments = [
        {"created_on":"2026-11-14T10:00:00Z",
         "versions":[{"version_id":"old","percentage":100}]},
        {"created_on":"2026-11-15T10:00:00Z",
         "versions":[{"version_id":CURRENT,"percentage":100}]}
    ]
    import copy
    assert validate(version, deployments)
    bad = []
    v = copy.deepcopy(version)
    v["resources"]["bindings"].append({"name":"DB","type":"d1"})
    bad.append((v, deployments))
    v = copy.deepcopy(version)
    v["id"]="wrong"
    bad.append((v, deployments))
    for field, value in (("version_id","wrong"),("percentage",80)):
        d=copy.deepcopy(deployments)
        d[-1]["versions"][0][field]=value
        bad.append((version,d))
    d=copy.deepcopy(deployments)
    d[-1]["versions"].append({"version_id":"unexpected","percentage":0})
    bad.append((version,d))
    d=copy.deepcopy(deployments)
    d[-1]["created_on"]="BAD DATE"
    bad.append((version,d))
    bad.extend([(version,[]), (version,{"versions":[]})])
    for v,d in bad:
        try:
            validate(v,d)
        except Unverified:
            continue
        raise AssertionError("unsafe synthetic Cloudflare state passed")
    print("PASS: synthetic preflight rejects binding drift, wrong active version, split traffic, bad timestamps")
    print("LIMIT: no actual Cloudflare version data was fetched")

if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    elif sys.argv[1:] == ["--check"]:
        sys.exit(check())
    else:
        print("Usage: --self-test | --check (read-only; no upload/deploy mode)")
        sys.exit(2)
