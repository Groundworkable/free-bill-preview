"""Desktop/mobile smoke for the static noncharging pre-purchase release."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server=ThreadingHTTPServer(("127.0.0.1",0),partial(Handler,directory=str(ROOT)))
thread=Thread(target=server.serve_forever,daemon=True)
thread.start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        for width,height in ((1440,900),(390,844)):
            page=browser.new_page(viewport={"width":width,"height":height})
            errors=[]
            page.on("pageerror",lambda ex: errors.append(str(ex)))
            base=f"http://127.0.0.1:{server.server_port}"
            page.goto(base+"/preorder/",wait_until="networkidle")
            assert "Pre-purchases are not open yet." in page.locator("#gateNotice").inner_text()
            assert page.locator('[data-offer="monthly"] .amount').inner_text()=="$9.99"
            assert page.locator('[data-offer="annual"] .amount').inner_text()=="$96"
            assert page.locator("#checkoutMonthly").evaluate("(n)=>n.tagName")=="SPAN"
            assert page.locator("#checkoutAnnual").evaluate("(n)=>n.tagName")=="SPAN"
            assert page.locator('a[href*="stripe.com"]').count()==0
            assert page.locator("form,input,button,iframe,script").count()==0
            assert page.locator('a[href="/contact/"]').count()==1
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
            assert not errors,errors
            page.close()
            print(f"PASS {width}px: safe, readable noncharging page; no checkout or horizontal overflow")
        browser.close()
finally:
    server.shutdown()
    server.server_close()
