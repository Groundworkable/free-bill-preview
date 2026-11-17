"""Observe *public-only* analytics network requests in Chromium, without consent interaction.

Read-only network verification for legal disclosure evidence. Does not submit
forms, log in, click cookie banners, grant consent, install trackers, alter the
website, authorize checkout, or save personal browser data.
"""
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse

PAGES = (
    "https://groundworkbyable.online/",
    "https://groundworkbyable.online/privacy.html",
    "https://groundworkbyable.online/contact/",
)
TRACK_HOSTS = {
    "www.google-analytics.com",
    "google-analytics.com",
    "region1.google-analytics.com",
    "analytics.google.com",
    "www.googletagmanager.com",
    "googletagmanager.com",
    "zaraz.cloudflare.com",
}
def kind(url):
    p = urlparse(url)
    hostname = (p.hostname or "").lower()
    if hostname in TRACK_HOSTS or hostname.endswith(".google-analytics.com"):
        return "Google Analytics / Tag Manager request"
    if p.path.startswith("/cdn-cgi/zaraz/"):
        return "Cloudflare Zaraz request"
    return None

observed = 0
with sync_playwright() as w:
    browser = w.chromium.launch(headless=True)
    try:
        for url in PAGES:
            context = browser.new_context(
                locale="en-US",
                service_workers="block",
                java_script_enabled=True,
                accept_downloads=False,
            )
            page = context.new_page()
            events = set()
            page.on("request", lambda req: events.add(kind(req.url)) if kind(req.url) else None)
            short = urlparse(url).path or "/"
            try:
                response = page.goto(url, wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(1500)
                title = page.title()
                if response is None or response.status != 200:
                    print(f"UNVERIFIED {short}: browser did not receive public HTTP 200 HTML")
                else:
                    print(f"BROWSER {short}: public HTTP 200, {len(events)} analytics-request categories observed")
                    if events:
                        print("  " + ", ".join(sorted(events)))
                        observed += len(events)
                    else:
                        print("  No GA4/GTM/Zaraz network requests observed in anonymous no-interaction session")
            except Exception as e:
                print(f"UNVERIFIED {short}: browser read failed ({type(e).__name__})")
            finally:
                context.close()
    finally:
        browser.close()
if not observed:
    print("RELEASE EVIDENCE GAP: no public page analytics requests observed in this test session.")
    print("This cannot exclude consent-conditioned tracking, other devices, or separate GA4 streams.")
else:
    print("RUNTIME OBSERVATION: at least one public page loaded an analytics service.")
    print("A matching GA4 data-stream ID, consent behavior, and legitimate data processing remain to verify.")
print("READ-ONLY BROWSER DIAGNOSTIC. No consent granted, pages modified, or payments activated.")
