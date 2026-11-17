"""Hard gates for the specifically authorized Nov 17, 2026 legal-only release.

This checks built static site output; it does not deploy or authorize billing.
The expected fingerprints are of founder-approved, immutable legal sections.
"""
import hashlib
import re
import xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
COMPANY=[
 "contact/index.html","contact.html","about/index.html","about.html",
 "faqs/index.html","faqs.html","legal/index.html","legal.html",
 "careers/index.html","careers.html",
]
PAGES=[
 "index.html","tour.html","tour/index.html","free-tools.html",
 "free-tools/index.html","organizations.html","organizations/index.html",
 "about.html","about/index.html","faqs.html","faqs/index.html",
 "contact.html","contact/index.html","careers.html","careers/index.html",
 "legal.html","legal/index.html","privacy.html","beta-terms.html",
]
CONSENT='<script defer src="/assets/js/ga4-consent.js"></script>'
DATE="2026-11-17"
PRIVACY_HASH="9a037a57bbec36fcec5d5c6a10fdd35486c30829f640d52fb78485ef56c90380"
TERMS_HASH="8dcdd9d9b9efb73f91709c8df830bf0901796ebb5ef42073b8be10356085ed9d"
POLICY_MARKER='<div class="kicker">Groundwork · Privacy</div>'
def normalized(s):return re.sub(r"\s+"," ",s).strip()
def extract(s,start,end):
 assert s.count(start)==1,(start,"not unique")
 return s[s.index(start):s.index(end,s.index(start))]
def sha(s):return hashlib.sha256(s.encode("utf-8")).hexdigest()
privacy=(ROOT/"privacy.html").read_text(encoding="utf-8")
terms=(ROOT/"prepurchase-terms/index.html").read_text(encoding="utf-8")
assert privacy.count('<section class="legal-section">')==13
assert terms.count("<h2>")==7
assert "Version: privacy-v2" in privacy and f"Effective date: {DATE}" in privacy
assert f"prepurchase-terms-v1 · {DATE}" in terms
assert "https://groundworkbyable.online/prepurchase-terms/" in terms
assert 'name="robots" content="index,follow"' in terms
assert "Pre-purchase checkout remains unavailable" in terms
assert "/prepurchase-terms/" in privacy
assert sha(extract(privacy,'<section class="legal-section">','<div class="legal-links">'))==PRIVACY_HASH,"Approved Privacy sections differ"
assert sha(extract(terms,'<h2>1. What you are buying</h2>','</article>'))==TERMS_HASH,"Approved Terms sections differ"
assert all(s.lower() not in terms.lower() for s in ("prepublication","unpublished","noindex"))
public_article=normalized(extract(privacy,POLICY_MARKER,'<div class="legal-links">'))
for path in COMPANY:
 s=(ROOT/path).read_text(encoding="utf-8")
 assert normalized(extract(s,POLICY_MARKER,'\n\n </div></dialog>'))==public_article,path
 assert s.count('<section class="legal-section">')==13,path
 assert f"Effective date: {DATE}" in s,path
 assert "PUBLISHED PRIVACY POLICY · V2" in s,path
 for banned in ("privacy-v1","prepublication","pending authorized publication","Founder Review","NOT YET EFFECTIVE","PRIVACY V2 · PUBLICATION REVIEW"):
  assert banned.lower() not in s.lower(),(path,banned)
for path in PAGES:
 s=(ROOT/path).read_text(encoding="utf-8")
 assert s.count(CONSENT)==1,(path,"GA4 consent missing/duplicate")
 assert "preorder/checkout" not in s,(path,"Unexpected preorder code")
js=(ROOT/"assets/js/ga4-consent.js").read_text(encoding="utf-8")
assert "G-KZSJ1W4PXH" in js
assert 'choice!=="granted"' in js and "globalPrivacyControl" in js
assert "ad_personalization:\"denied\"" in js
assert not (ROOT/"preorder").exists(),"Unapproved payment assets in legal release"
assert not (ROOT/"review").exists(),"Unpublished legal review artifacts leaked to public build"
assert not (ROOT/"groundwork-legal-cutover-PREVIEW-ONLY").exists(),"Offline previews leaked to public build"
assert not (ROOT/"groundwork-LEGAL-PUBLICATION-STAGED-NOT-DEPLOYED").exists(),"Staging artifacts leaked"
assert not (ROOT/"prepurchase-terms.html").exists(),"Unreviewed second Terms URL"
sitemap=(ROOT/"sitemap.xml").read_text(encoding="utf-8")
ET.fromstring(sitemap)
assert sitemap.count("https://groundworkbyable.online/prepurchase-terms/")==1
assert sitemap.count("https://groundworkbyable.online/privacy.html")==1
print("PASS: authorized Nov 17 legal-only publication, approved legal SHA256 unchanged")
print("PASS: 10 Company mirrors match standalone Privacy V2, 7-term public canonical route, 19 consent pages")
print("PASS: no review/checkout/live payment/membership artifacts introduced")
