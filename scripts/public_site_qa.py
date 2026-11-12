from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(".")
PUBLIC = ["index.html", "tour.html", "free-tools.html", "organizations.html",
          "about.html", "faqs.html", "contact.html", "careers.html", "legal.html"]
BANNED = ("$375", "$2,400", "$4,200", "$84", "price:375",
          "price:2400", "price:4200", "$5.00")
class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.scripts = []
        self.media = []
        self.script_body = []
        self.in_script = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, f"Duplicate ID: {attrs['id']}"
            self.ids.add(attrs["id"])
        if tag == "a":
            self.links.append(attrs.get("href", ""))
        if tag in ("img", "source", "video", "script"):
            for attribute in ("src", "poster"):
                if attrs.get(attribute):
                    self.media.append(attrs[attribute])
        if tag == "script" and not attrs.get("src"):
            self.in_script = True
            self.script_body.append("")
    def handle_data(self, data):
        if self.in_script and self.script_body:
            self.script_body[-1] += data
    def handle_endtag(self, tag):
        if tag == "script":
            self.in_script = False

def check_url(url, name):
    if not url or url.startswith(("mailto:", "https:", "http:", "tel:", "data:", "#")):
        return
    assert not url.startswith(("javascript:", "//")), (name, "unsafe URL", url)
    path = unquote(urlsplit(url).path)
    assert path, (name, "empty path", url)
    target = ROOT / path.lstrip("/")
    assert target.exists(), (name, "broken local link", url)

for name in PUBLIC:
    content = (ROOT/name).read_text(encoding="utf-8")
    page = Page()
    page.feed(content)
    assert "<title>" in content, f"{name}: missing title"
    for stale in BANNED:
        assert stale not in content, (name, "superseded offer", stale)
    for url in page.links + page.media:
        check_url(url, name)
    for script in page.script_body:
        if not script.strip():
            continue
        with tempfile.NamedTemporaryFile(mode="w", suffix=".js", encoding="utf-8") as f:
            f.write(script)
            f.flush()
            subprocess.run(["node", "--check", f.name], check=True)
# Organizations pre-release commercial regression coverage.
org = (ROOT/"organizations.html").read_text(encoding="utf-8")
assert org.count('class="plan" type="button"') == 3, "Preserve three main pricing cards"
assert 'data-plan="twentyfive"' in org, "25-seat annual continuation must be selectable"
assert 'value="twentyfive"' in org, "Annual continuation missing from inquiry options"
for amount in ("$450", "$1,800", "$3,000", "$5,400"):
    assert amount in org, f"Missing approved organization offer: {amount}"
assert "price:1800" in org and "price:450" in org
assert "25 people · Annual continuation · $1,800" in org
assert "separate decision" in org and "no automatic renewal" in org
assert "seat reassignment" in org and "post-sponsorship access" in org
assert "contactCopyAndEmail" in org and "mailto:" in org
assert "business form" not in org.lower(), "No verified live business form exists"
assert "FOUNDER REVIEW / NON-LIVE" not in org
assert "B2B REVIEW · NOT LIVE" not in org
assert "does not give sponsors access" in org
assert "not a live offer or contract" in org
# Extension-free website routes: folder entrypoints, canonical addresses, and legacy files.
from urllib.parse import urlparse
SLUGS = ["tour", "free-tools", "organizations", "about", "faqs", "contact", "careers", "legal"]
for slug in SLUGS:
    path = ROOT / slug / "index.html"
    assert path.exists(), f"Missing clean route: /{slug}/"
    assert (ROOT / (slug + ".html")).exists(), f"Legacy .html link removed: {slug}"
    content = path.read_text(encoding="utf-8")
    assert 'rel="canonical" href="https://groundworkbyable.online/' + slug + '/"' in content
    page = Page()
    page.feed(content)
    for link in page.links + page.media:
        check_url(link, str(path))
    for script in page.script_body:
        if script.strip():
            with tempfile.NamedTemporaryFile(mode="w", suffix=".js", encoding="utf-8") as f:
                f.write(script)
                f.flush()
                subprocess.run(["node", "--check", f.name], check=True)
assert 'rel="canonical" href="https://groundworkbyable.online/"' in (ROOT/"index.html").read_text()
sitemap_text = (ROOT/"sitemap.xml").read_text(encoding="utf-8")
assert "https://groundworkbyable.online/index.html" not in sitemap_text
for slug in SLUGS:
    assert "https://groundworkbyable.online/" + slug + "/" in sitemap_text
assert "Life doesn't" in (ROOT/"index.html").read_text()
assert "bloom-orbit.mp4" in (ROOT/"index.html").read_text()
free_page = Page()
free_page.feed((ROOT/"free-tools.html").read_text(encoding="utf-8"))
assert {"tab-rate", "tab-purchase", "tab-subscription", "tab-variable"} <= free_page.ids
assert (ROOT/"media/bloom-orbit.mp4").read_bytes()[4:8] == b"ftyp"
assert (ROOT/"media/bloom-poster.jpg").read_bytes()[:2] == bytes([255, 216])
assert (ROOT/"media/bloom-orbit.mp4").stat().st_size > 1_000_000
assert "groundworkbyable.online" in (ROOT/"CNAME").read_text()
for path in ("privacy.html", "beta-terms.html"):
    assert (ROOT/path).exists(), "Preserve published policy: "+path
ET.parse(ROOT/"sitemap.xml")
print("PASS: all nine pages, original Bloom video/poster, four calculators, links, JS syntax, current pricing and published legal sources")
