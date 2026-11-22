"""Check clean public routes in a real Chromium browser using a local static server.

Keep legacy *.html URLs usable; all new page links and route assets must resolve.
"""
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / "review-captures"
CAPTURES.mkdir(exist_ok=True)
def capture(page, name, *, emit=False):
    jpeg = page.screenshot(type="jpeg", quality=68, animations="disabled", full_page=False)
    (CAPTURES / (name + ".jpg")).write_bytes(jpeg)
    if emit:
        print("GROUNDWORK_VISUAL_" + name + "_BASE64=" + base64.b64encode(jpeg).decode("ascii"), flush=True)

SLUGS = ("tour", "free-tools", "organizations", "about", "faqs",
         "contact", "careers", "legal")


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
base = f"http://127.0.0.1:{server.server_port}"
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for width, height in ((1440, 900), (390, 844)):
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda err: errors.append(str(err)))
            response = page.goto(base + "/", wait_until="domcontentloaded")
            assert response and response.status == 200
            assert page.locator('[data-nav="/tour/"]').count() > 0
            assert page.locator('[data-nav="/organizations/"]').count() > 0
            capture(page, f"home-{width}", emit=True)
            video = page.locator('video#bloom source[type="video/mp4"]')
            assert video.count() == 1
            assert video.get_attribute("src") == "./media/groundwork-bloom-loop.mp4"
            assert context.request.head(base + "/media/groundwork-bloom-loop.mp4").status == 200
            assert context.request.head(base + "/media/groundwork-bloom-backdrop.png").status == 200
            for slug in SLUGS:
                response = page.goto(base + "/" + slug + "/", wait_until="domcontentloaded")
                assert response and response.status == 200, (slug, response.status if response else None)
                canonical = page.locator('link[rel="canonical"]').get_attribute("href")
                assert canonical == "https://groundworkbyable.online/" + slug + "/", (slug, canonical)
                assert page.locator("title").count() == 1, slug
                legacy = context.request.get(base + "/" + slug + ".html")
                assert legacy.status == 200, slug
            response = page.goto(base + "/tour", wait_until="domcontentloaded")
            assert response and response.status == 200
            assert urlparse(page.url).path == "/tour/", page.url
            # Only capture the public Tour story; never real account or customer data.
            page.goto(base + "/tour/", wait_until="domcontentloaded")
            capture(page, f"tour-story-{width}")
            # The Experience is a separate interactive single-page product illustration.
            response=page.goto(base + "/experience/", wait_until="domcontentloaded")
            assert response and response.status == 200
            assert page.locator('.piece').count() == 15
            assert page.locator('#approvedRoomImage').count() == 1
            assert page.locator('#approvedRoomImage').is_hidden()
            capture(page, f"experience-hero-{width}", emit=True)
            assert page.locator('#detailTitle').inner_text() == "Dashboard"
            page.locator('.piece[data-room="5"]').click()
            assert page.locator('#detailTitle').inner_text() == "Assets & Inventory"
            page.locator('#revealAll').click()
            assert page.locator('.piece.revealed').count() == 15
            page.locator('#resetPuzzle').click()
            assert page.locator('.piece.revealed').count() == 1
            page.evaluate("window.scrollTo(0, document.querySelector('#explore').offsetTop)")
            capture(page, f"experience-puzzle-{width}", emit=True)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), "Experience content extends past viewport"
            if width < 500:
                page.locator('#explore').scroll_into_view_if_needed()
                capture(page, f"experience-detail-mobile-{width}")
            # Coherent pre-purchase journey; never invoke or complete an external payment.
            page.goto(base + "/tour/#membership", wait_until="domcontentloaded")
            # Hash-only navigation may legitimately return no new HTTP response.
            assert urlparse(page.url).path == "/tour/" and urlparse(page.url).fragment == "membership"
            assert page.locator('.page.pricing.active').count() == 1
            assert page.locator('[data-offer-view="prepurchase"]').get_attribute("aria-pressed") == "true"
            assert page.locator('[data-plan="monthly"]').get_attribute("aria-pressed") == "true"
            assert page.locator("#priceTotal").inner_text() == "$9.99"
            capture(page, f"membership-{width}", emit=True)
            geom=page.evaluate("""() => Object.fromEntries(['.site','.state','.page.pricing','.pricing .twocol','.pricing-panel'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [selector,{left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)}]}))""")
            print(f"GROUNDWORK_GEOMETRY_{width}: {geom} / viewport={width}",flush=True)
            assert page.locator('.pricing .twocol').evaluate("(el) => el.scrollWidth <= el.clientWidth + 2"), "Membership content overflows its column"
            assert page.locator('.pricing-panel').evaluate("(el) => el.getBoundingClientRect().right <= innerWidth + 2"), "Membership panel exceeds viewport"
            if width < 500:
                page.locator(".page.pricing.active").evaluate("(el) => {el.scrollTop = el.scrollHeight;}")
                capture(page, f"membership-mobile-bottom-{width}")
                page.locator(".page.pricing.active").evaluate("(el) => {el.scrollTop = 0;}")
            assert page.locator("#prepurchaseSelectedLink").get_attribute("href") == "/preorder/?plan=monthly"
            page.locator('[data-plan="annual"]').click()
            assert page.locator("#priceTotal").inner_text() == "$96"
            assert page.locator("#prepurchaseSelectedLink").get_attribute("href") == "/preorder/?plan=annual"
            for view in ("founding", "lite", "standard"):
                page.locator(f'[data-offer-view="{view}"]').click()
                assert page.locator(f'[data-view="{view}"]').is_visible()
                assert not page.locator('[data-view="prepurchase"]').is_visible()
            page.locator('[data-offer-view="prepurchase"]').click()
            assert page.locator('[data-view="prepurchase"]').is_visible()
            # The existing consent page must fail closed while links remain inactive.
            response = page.goto(base + "/preorder/?plan=annual", wait_until="domcontentloaded")
            assert response and response.status == 200
            page.locator("#gateNotice strong").wait_for()
            assert page.locator("#checkoutMonthly").get_attribute("href") is None
            assert page.locator("#checkoutAnnual").get_attribute("href") is None
            assert page.locator("#checkoutAnnual").get_attribute("aria-disabled") == "true"
            assert page.locator("#checkoutMonthly").get_attribute("aria-disabled") == "true"
            capture(page, f"preorder-closed-{width}")
            response = page.goto(base + "/sign-in/", wait_until="domcontentloaded")
            assert response and response.status == 200
            assert "not open yet" in page.locator("main").inner_text()
            assert page.locator("input").count() == 0
            assert page.locator("#days").inner_text() != "—"
            capture(page, f"sign-in-holding-{width}")
            assert not errors, f"JavaScript errors {width}px: {errors}"
            print(f"PASS: {width}px viewport, Bloom/clean routes, membership switches, fail-closed preorder, sign-in holding state")
            context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
