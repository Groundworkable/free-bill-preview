#!/usr/bin/env python3
"""Credential-free, read-only Cloudflare Access boundary smoke test.

One GET to the existing founder Worker. NEVER follows redirects, logs cookies,
performs review/dispatch, sends a notification, or mutates Cloudflare settings.

A pass confirms only that this single unauthenticated HTTP request was blocked
by a recognizable Access challenge. It does NOT prove founder login, the exact
allowlist, wrong-account denial, AUD equality, or any deployment safety.
"""
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

HOST = "groundwork-founder-notifications-isolated.groundworkbyable.workers.dev"
URL = "https://" + HOST + "/"
REDIRECT_CODES = {301, 302, 303, 307, 308}
MAX_BODY = 4096

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None

def access_redirect(location: str) -> bool:
    if not location:
        return False
    dest = urllib.parse.urlparse(urllib.parse.urljoin(URL, location))
    if dest.scheme != "https":
        return False
    hostname = (dest.hostname or "").lower()
    access_host = hostname == HOST or hostname.endswith(".cloudflareaccess.com")
    access_path = dest.path.startswith("/cdn-cgi/access/")
    return access_host and access_path

def blocked_by_access(code: int, headers, body: bytes) -> bool:
    if code in REDIRECT_CODES:
        return access_redirect(headers.get("Location", ""))
    if code in (401, 403):
        # Generic 403 is not proof an Access policy applied. Check Access branding.
        text = body[:MAX_BODY].decode("utf-8", errors="replace").lower()
        return any(phrase in text for phrase in (
            "cloudflare access", "access denied by cloudflare",
            "cloudflare zero trust", "your access is denied",
            "you do not have access to this application",
        ))
    return False

def unit_tests():
    assert blocked_by_access(302, {"Location": "/cdn-cgi/access/login/xyz"}, b"")
    assert blocked_by_access(302, {"Location": "https://example.cloudflareaccess.com/cdn-cgi/access/login/x"}, b"")
    assert blocked_by_access(403, {}, b"Cloudflare Access: forbidden")
    for code, headers, body in (
        (200, {}, b"ok"),
        (404, {}, b'{"status":"not_found"}'),
        (503, {}, b"Founder service disabled"),
        (403, {}, b"Forbidden"),
        (302, {"Location": "https://attacker.invalid/cdn-cgi/access/login/"}, b""),
        (302, {"Location": "/some-other-login"}, b""),
    ):
        assert not blocked_by_access(code, headers, body), (code, headers)

def main() -> int:
    unit_tests()
    request = urllib.request.Request(URL, method="GET", headers={
        "User-Agent": "GroundworkFounderAccessReadOnlyGate/1.0",
        "Cache-Control": "no-store",
    })
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=12) as response:
            code = response.status
            headers = response.headers
            body = response.read(MAX_BODY)
    except urllib.error.HTTPError as response:
        code = response.code
        headers = response.headers
        body = response.read(MAX_BODY)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        print("UNVERIFIED: founder Worker request failed: " + type(error).__name__)
        return 1

    if blocked_by_access(code, headers, body):
        # Never log the Location: redirects may contain session/identity details.
        print("PASS: founder Worker rejects this unauthenticated request with an Access challenge")
        print("LIMITATION: exact founder allowlist, AUD equality and logged-in identity are not tested")
        return 0

    print("UNSAFE OR UNVERIFIED: founder Worker did not produce a recognizable Access challenge")
    print("Observed HTTP status:", code)
    print("Do not upload/deploy a founder runtime or relax the current Access policy")
    return 1

if __name__ == "__main__":
    sys.exit(main())
