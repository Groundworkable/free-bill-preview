"""Read-only external HTTPS smoke test after authorized legal-only release.

Runs on GitHub Actions hosted runner, not a production Worker. Makes only
anonymous GET requests to publicly available pages; does not submit forms,
authorize Google Analytics, change cookies, call Stripe, or deploy anything.
"""
import re
import sys
import time
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from urllib.error import URLError, HTTPError

BASE="https://groundworkbyable.online"
PAGES={
 "/": ("Groundwork by Able",),
 "/privacy.html": ("Version: privacy-v2","Effective date: 2026-11-17"),
 "/prepurchase-terms/": ("prepurchase-terms-v1","2026-11-17",
                         "Pre-purchase checkout remains unavailable."),
 "/contact/": ("PUBLISHED SOURCE","PRIVACY-V2", "2026-11-17"),
 "/assets/js/ga4-consent.js": ("G-KZSJ1W4PXH","globalPrivacyControl",
                              "analytics_storage"),
}
ALLOWED={"groundworkbyable.online","www.groundworkbyable.online"}

def check_once():
    failures=[]
    for path,required in PAGES.items():
        url=BASE+path
        try:
            request=Request(url,headers={
                "User-Agent":"Groundwork-Authorized-Legal-Release-ReadOnly-Check/1.0",
                "Accept":"text/html,application/javascript",
                "Cache-Control":"no-cache",
            })
            with urlopen(request,timeout=15) as response:
                final=urlparse(response.geturl())
                if final.scheme!="https" or final.hostname not in ALLOWED:
                    failures.append((path,"unexpected redirect host"))
                    continue
                if response.status!=200:
                    failures.append((path,f"HTTP {response.status}"))
                    continue
                data=response.read(1600000).decode("utf-8",errors="replace")
            missing=[term for term in required if term not in data]
            if missing:
                failures.append((path,"required release markers not present"))
                print(f"NOT YET VERIFIED {path}: required live publication markers not present")
                continue
            if path=="/prepurchase-terms/":
                if "noindex,nofollow" in data.lower() or "PREPUBLICATION REVIEW" in data:
                    failures.append((path,"Terms still prepublication"))
                    continue
                if data.count("<h2>")!=7:
                    failures.append((path,"seven Terms sections missing"))
                    continue
            if path=="/privacy.html":
                if data.count('<section class="legal-section">')!=13:
                    failures.append((path,"13 Privacy sections missing"))
                    continue
                if '<script defer src="/assets/js/ga4-consent.js"></script>' not in data:
                    failures.append((path,"consent loader missing"))
                    continue
            if path=="/":
                if "groundwork-bloom-loop.mp4" not in data:
                    failures.append((path,"approved Bloom entrance absent"))
                    continue
            print(f"VERIFIED LIVE {path}: HTTPS 200 and release content match")
        except (URLError,HTTPError,TimeoutError,OSError,ValueError) as e:
            failures.append((path,type(e).__name__))
            print(f"NOT YET VERIFIED {path}: HTTPS probe failed ({type(e).__name__})")
    return failures

for attempt in range(1,5):
    print(f"External live release verification, attempt {attempt}/4")
    problems=check_once()
    if not problems:
        print("PASS: legal-only release is live on public HTTPS, published Terms/Privacy V2 match")
        print("PASS: Bloom preserved, GA4 opt-in asset available; test did not grant analytics consent")
        print("No checkout, Stripe, app account, customer email or production change was made by this probe")
        sys.exit(0)
    if attempt<4:
        time.sleep(10)
print("FAIL: external publication check incomplete; do not claim public deployment complete")
print("Unverified paths: "+", ".join(path for path,_ in problems))
sys.exit(1)
