"""Verify real pre-purchase UI is fail-closed and cannot invent payment success."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for width, height in [(1440, 900), (390, 844)]:
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            base = f"http://127.0.0.1:{server.server_port}"
            page.goto(base+"/preorder/?plan=annual", wait_until="networkidle")
            for key in ("Monthly", "Annual"):
                a = page.locator("#checkout"+key)
                assert a.get_attribute("href") is None, key
                assert a.get_attribute("aria-disabled") == "true", key
            assert page.locator("#publishedTerms").is_hidden()
            assert "not open yet" in page.locator("#gateNotice").inner_text()
            assert page.locator("[data-offer='monthly'] .amount").inner_text() == "$9.99"
            assert page.locator("[data-offer='annual'] .amount").inner_text() == "$96"
            assert not errors, errors
            print(f"PASS {width}px: disabled pre-purchase, no payment link or fake confirmation")
            context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
