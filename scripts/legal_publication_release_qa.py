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
DATE="2026-11-22"
TERMS_DATE="2026-11-17"
PRIVACY_HASH="83680bf325bb6276e63726903157697e0a6b54e2b0aeca913a43e6c1d4da3141"
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
assert "Version: privacy-v3" in privacy and f"Effective date: {DATE}" in privacy
assert f"prepurchase-terms-v1 · {TERMS_DATE}" in terms
assert "https://groundworkbyable.online/prepurchase-terms/" in terms
assert 'name="robots" content="index,follow"' in terms
assert "These terms govern one-time Groundwork pre-purchases when checkout is enabled." in terms
assert "/prepurchase-terms/" in privacy
assert sha(privacy[privacy.index('<section class="legal-section">'):privacy.rindex("</section>")+len("</section>")])==PRIVACY_HASH,"Approved Privacy sections differ"
assert sha(extract(terms,'<h2>1. What you are buying</h2>','</article>'))==TERMS_HASH,"Approved Terms sections differ"
assert all(s.lower() not in terms.lower() for s in ("prepublication","unpublished","noindex"))
public_article=normalized(extract(privacy,POLICY_MARKER,'<div class="legal-links">'))
for path in COMPANY:
 s=(ROOT/path).read_text(encoding="utf-8")
 assert normalized(extract(s,POLICY_MARKER,'\n\n </div></dialog>'))==public_article,path
 assert s.count('<section class="legal-section">')==13,path
 assert f"Effective date: {DATE}" in s,path
 assert "PUBLISHED PRIVACY POLICY · V3" in s,path
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
# Controlled informational-only exception: preorder files are permitted only with checkout fail-closed.
preorder=ROOT/"preorder"
if preorder.exists():
 import json
 assert preorder.is_dir(),"Preorder path must be a directory"
 assert {p.name for p in preorder.iterdir()}=={"index.html","checkout-config.json"},"Unexpected files in preorder"
 cfg=json.loads((preorder/"checkout-config.json").read_text(encoding="utf-8"))
 assert cfg["enabled"] is False and cfg["termsApproved"] is False,"Preorder checkout must remain disabled"
 assert cfg["termsUrl"]=="https://groundworkbyable.online/prepurchase-terms/"
 assert cfg["refundPolicyUrl"]=="https://groundworkbyable.online/prepurchase-terms/"
 assert set(cfg["offers"])=={"monthly","annual"}
 for key,amount in (("monthly",9.99),("annual",96)):
  offer=cfg["offers"][key]
  assert offer["paymentLink"] is None,(key,"LIVE checkout URL exposed")
  assert offer["amountUsd"]==amount and offer["currency"]=="usd"
  assert offer["paymentMode"]=="one_time" and offer["taxBehavior"]=="exclusive"
  assert offer["taxCode"]=="txcd_10103000"
 page=(preorder/"index.html").read_text(encoding="utf-8")
 assert "https://buy.stripe.com/" not in page,"LIVE payment URL in page"
 assert 'fetch("/preorder/checkout-config.json"' in page,"Missing config gate"
 assert 'if(!valid){disable();return;}' in page,"Missing default-off guard"
 assert 'const valid=cfg && cfg.enabled===true && cfg.termsApproved===true' in page
 assert 'a.removeAttribute("href")' in page and 'a.setAttribute("aria-disabled","true")' in page
 assert '<a href="/prepurchase-terms/">' in page,"Public legal terms not linked"
assert not (ROOT/"review").exists(),"Unpublished legal review artifacts leaked to public build"
assert not (ROOT/"groundwork-legal-cutover-PREVIEW-ONLY").exists(),"Offline previews leaked to public build"
assert not (ROOT/"groundwork-LEGAL-PUBLICATION-STAGED-NOT-DEPLOYED").exists(),"Staging artifacts leaked"
assert not (ROOT/"prepurchase-terms.html").exists(),"Unreviewed second Terms URL"
sitemap=(ROOT/"sitemap.xml").read_text(encoding="utf-8")
ET.fromstring(sitemap)
assert sitemap.count("https://groundworkbyable.online/prepurchase-terms/")==1
assert sitemap.count("https://groundworkbyable.online/privacy.html")==1
print("PASS: staged Privacy V3 fingerprint and original purchaser Terms V1 body unchanged")
print("PASS: 10 Company mirrors match staged standalone Privacy V3, 7-term public canonical route, 19 consent pages")
print("PASS: optional informational preorder page remains fail-closed; no LIVE checkout URL or membership artifacts")
