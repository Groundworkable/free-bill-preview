"""Check clean public routes in a real Chromium browser using a local static server.

Keep legacy *.html URLs usable; all new page links and route assets must resolve.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
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
            assert page.locator('a[href="/tour/"]').count() > 0
            assert page.locator('a[href="/organizations/"]').count() > 0
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
            assert not errors, f"JavaScript errors {width}px: {errors}"
            print(f"PASS: {width}px viewport, all 8 clean routes, legacy pages, canonical URLs, redirects")
            context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
