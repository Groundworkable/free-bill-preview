"""Public-only, read-only analytics evidence probe for Groundwork's legal release.

GitHub Actions runners can test external HTTPS even when the model's tools
cannot. This does not install tracking, set cookies, authenticate, publish,
or verify that analytics events actually reach a GA4 property.

Failure to fetch or absence of tags is evidence of uncertainty, NOT proof
that Google Analytics does not run (consent gates or edge injection possible).
Never use this script to bypass the site's consent mechanisms.
"""
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from urllib.error import URLError, HTTPError
import re
import sys

BASE = "https://groundworkbyable.online"
PATHS = ("/", "/privacy.html", "/contact/")
ALLOW = {"groundworkbyable.online", "www.groundworkbyable.online"}
# Deliberately no source dump, analytics IDs, IPs, keys, cookies or user data in logs.
TAG_PATTERNS = {
    "GA4 / Google Tag Manager loader":
        re.compile(r"googletagmanager\.com/(?:gtag/js|gtm\.js)", re.I),
    "Google Analytics classic loader":
        re.compile(r"google-analytics\.com/(?:analytics\.js|gtag)", re.I),
    "gtag config call":
        re.compile(r"\bgtag\s*\(\s*['\"]config['\"]", re.I),
    "GA4 dataLayer bootstrap":
        re.compile(r"(?:window\.)?dataLayer\s*=", re.I),
    "Cloudflare Zaraz injection":
        re.compile(r"(?:/cdn-cgi/zaraz/|zaraz\.cloudflare\.com)", re.I),
}

class Sources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "script" and a.get("src"):
            self.urls.append(a["src"])

def analyze(html):
    result = [name for name, p in TAG_PATTERNS.items() if p.search(html)]
    sources = Sources()
    sources.feed(html)
    if any("googletagmanager.com" in x or "zaraz" in x for x in sources.urls):
        result.append("external script reference")
    return sorted(set(result))

success = 0
tags = 0
for path in PATHS:
    url = BASE + path
    try:
        request = Request(url, headers={
            "User-Agent": "Groundwork-ReadOnly-Release-Verification/1.0",
            "Accept": "text/html",
            "Cache-Control": "no-cache",
        })
        with urlopen(request, timeout=12) as response:
            final = urlparse(response.geturl())
            if final.scheme != "https" or final.hostname not in ALLOW:
                print(f"UNVERIFIED {path}: redirected to unrecognized host; no content inspected")
                continue
            code = response.status
            mime = response.headers.get("Content-Type", "")
            if code != 200 or "html" not in mime.lower():
                print(f"UNVERIFIED {path}: HTTP {code} or non-HTML response")
                continue
            body = response.read(1000000).decode("utf-8", errors="replace")
            found = analyze(body)
            success += 1
            tags += int(bool(found))
            if found:
                print(f"OBSERVED {path}: " + ", ".join(found))
            else:
                print(f"NOT OBSERVED {path}: no recognizable GA/GTM/Zaraz tag in anonymous HTML response")
    except (URLError, HTTPError, TimeoutError, OSError, ValueError) as exc:
        # Do not leak response bodies or identifiers; only a short exception class.
        print(f"UNVERIFIED {path}: public HTTPS fetch failed ({type(exc).__name__})")

if success == 0:
    print("RELEASE EVIDENCE GAP: all public-site reads unavailable from this runner.")
elif tags == 0:
    print("RELEASE EVIDENCE GAP: fetched public HTML had no detectable analytics tags.")
    print("GA4 could still be loaded with a consent step, dynamic code, or edge logic.")
else:
    print("EVIDENCE: an analytics-related loader was present in at least one public response.")
    print("A live GA4 network request, matching web data stream and consent still need verification.")
print("READ-ONLY. No legal publication, tracking changes, cookie setting, payment or deployment.")
# Diagnostic is informational. Fail-closed legal publication is a separate gate.
sys.exit(0)
