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
