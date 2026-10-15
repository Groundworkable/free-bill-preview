from html.parser import HTMLParser
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

class Check(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.ids = set()
        self.imgs = []
        self.title = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and "href" in a: self.links.append(a["href"])
        if "id" in a: self.ids.add(a["id"])
        if tag == "img": self.imgs.append(a.get("src", ""))

pages = ["index.html", "why-groundwork.html", "explore.html", "early-access.html"]
for page in pages:
    text = Path(page).read_text(encoding="utf-8")
    p=Check();p.feed(text)
    assert "<title>" in text and 'name="description"' in text, f"Missing metadata: {page}"
    for link in p.links:
        if link.startswith("/"):
            dest=link.split("#",1)[0].split("?",1)[0]
            if dest and dest != "/":
                assert Path(dest.lstrip("/")).exists(), f"Broken link {link} in {page}"
    for link in p.links:
        if "#" not in link:
            continue
        dest, anchor = link.split("#", 1)
        if not anchor:
            continue
        if dest in ("", "/"):
            target = page if dest == "" else "index.html"
            target_parser = Check()
            target_parser.feed(Path(target).read_text(encoding="utf-8"))
            assert anchor in target_parser.ids, f"Broken anchor {link} in {page}"
    for img in p.imgs:
        if img.startswith("/"):
            assert Path(img.lstrip("/")).exists(), f"Missing image {img} in {page}"
    print(f"PASS {page}: {len(p.links)} links checked")
text=Path("index.html").read_text(encoding="utf-8")
assert 'id="billForm"' in text
assert 'id="variableForm"' in text
assert 'id="earlyAccessForm"' in text
assert 'assets/js/app.js' in text
assert 'G-KZSJ1W4PXH' in text
assert "groundworkbyable.online" in Path("CNAME").read_text()
ET.parse("sitemap.xml")
print("PASS existing free tools, beta form, Google Analytics, custom domain, sitemap")

# Core campaign-readiness contract.
index_text = Path("index.html").read_text(encoding="utf-8")
early_text = Path("early-access.html").read_text(encoding="utf-8")
shared_js = Path("assets/js/early-access.js").read_text(encoding="utf-8")
for page, html in (("index.html", index_text), ("early-access.html", early_text)):
    assert 'data-groundwork-intake' in html, f"Missing public signup in {page}"
    assert 'data-intake-status' in html, f"Missing submission feedback in {page}"
    assert "early-access.js" in html, f"Missing shared intake handler in {page}"
assert "mode: 'no-cors'" in shared_js, "Existing cross-origin endpoint behavior unexpectedly changed"
assert "opaque response" in shared_js, "Must disclose uncertain API outcome"
assert "sendGroundworkEvent('early_access_submitted')" not in Path("assets/js/app.js").read_text(encoding="utf-8"), "Old handler not fully removed"
print("PASS shared beta intake script, both form locations, and anchor checks")
