"""Fail-closed regression check for informational-only pre-purchase page.

No payment infrastructure or legal publications are included in this site PR.
These assertions are static; desktop/mobile browser checks are separate.
"""
from pathlib import Path
from html.parser import HTMLParser
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/"preorder/index.html"
TOUR=ROOT/"tour/index.html"
SITEMAP=ROOT/"sitemap.xml"
INDEX=ROOT/"index.html"
page=PAGE.read_text(encoding="utf-8")
tour=TOUR.read_text(encoding="utf-8")

class Scan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links=[]
        self.scripts=0
        self.forms=0
        self.controls=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=="a":
            self.links.append(attrs.get("href"))
        elif tag=="script":
            self.scripts+=1
        elif tag=="form":
            self.forms+=1
        elif tag in ("button","input","select","iframe"):
            self.controls.append((tag,attrs))

scan=Scan()
scan.feed(page)
assert scan.scripts==0, "No script/payment gate belongs in informational release"
assert scan.forms==0, "Informational release cannot accept customer data"
assert not scan.controls, f"Unexpected actionable payment control: {scan.controls}"
assert "$9.99" in page and "$96" in page
assert "one-time" in page.lower()
assert "Pre-purchases are not open yet." in page
assert "No payment is collected on this page." not in page or "no checkout" in page.lower()
assert "Payment not available" in page
assert page.count('class="button is-unavailable"')==2
assert "<span" in page and 'id="checkoutMonthly"' in page and 'id="checkoutAnnual"' in page
assert "/contact/" in scan.links and "/" in scan.links
assert all(not (u or "").startswith(("https://buy.stripe.com","mailto:")) for u in scan.links)
for forbidden in (
  "checkout-config.json","buy.stripe.com","paymentLink","acceptTerms",
  "Stripe Checkout","customer_email","fetch(","window.location","href=\"https://",
):
    assert forbidden not in page, f"Forbidden checkout/redirect reference: {forbidden}"
assert 'href="/preorder/"' in tour
assert "payments not open" in tour.lower()
assert "data-checkout=\"personal\"" in tour, "Do not alter existing tour flow"
assert "groundwork-bloom-loop.mp4" in INDEX.read_text(encoding="utf-8")
root=ET.parse(SITEMAP).getroot()
urls=[v.text for v in root.iter() if v.tag.endswith("loc")]
assert "https://groundworkbyable.online/preorder/" in urls
assert not (ROOT/"preorder/checkout-config.json").exists(), "Do not copy checkout configuration to static release"
assert not (ROOT/"preorder/payment-service").exists(), "Do not copy payment backend to public release"
print("PASS: public preorder information linked from tour; no checkout, forms, scripts, card payment or membership activation")
