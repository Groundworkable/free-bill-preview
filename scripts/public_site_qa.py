from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET

class Check(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
    def handle_starttag(self, tag, attrs):
        info = dict(attrs)
        if "id" in info:
            assert info["id"] not in self.ids, f"Duplicate ID {info['id']}"
            self.ids.add(info["id"])
        if tag == "a" and "href" in info:
            self.links.append(info["href"])

landing = Path("index.html").read_text(encoding="utf-8")
checker = Check()
checker.feed(landing)
assert "We're improving your experience." in landing
assert 'id="free-tools"' in checker.ids
for id in ("billForm","variableForm","takeHomePay","hoursWorked","billAmount","billName",
           "takeHomeRate","billTab","variableTab","previewEyebrow","previewTitle","previewText",
           "billCta","variableCta"):
    assert id in checker.ids, f"Missing calculator ID: {id}"
assert 'assets/js/app.js' in landing
js = Path("assets/js/app.js").read_text(encoding="utf-8")
assert "const netRate = takeHome / worked;" in js
assert "const workingHours = amount / netRate;" in js
assert "billForm.addEventListener('submit'" in js
assert "variableForm.addEventListener('submit'" in js
assert "G-KZSJ1W4PXH" in landing
assert "groundworkbyable.online" in Path("CNAME").read_text()
for word in ("payhip.com","etsy.com","/early-access.html","/explore.html","Request Beta Access"):
    assert word not in landing, f"Unexpected public marketing content {word}"
for path in ("why-groundwork.html","explore.html","early-access.html"):
    html=Path(path).read_text(encoding="utf-8")
    assert 'content="0;url=/"' in html, f"Marketing route not redirected: {path}"
for path in ("privacy.html","beta-terms.html"):
    assert Path(path).exists()
ET.parse("sitemap.xml")
print("PASS maintenance splash, calculators and existing computation, hidden marketing routes, analytics, legal pages, sitemap")
