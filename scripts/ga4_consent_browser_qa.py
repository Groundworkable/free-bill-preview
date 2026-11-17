"""Mocked public consent browser QA; zero actual GA4 or production requests."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SOURCE=(ROOT/"assets/js/ga4-consent.js").read_text(encoding="utf-8")
PAGES=["index.html","tour.html","tour/index.html","free-tools.html","free-tools/index.html",
"organizations.html","organizations/index.html","about.html","about/index.html",
"faqs.html","faqs/index.html","contact.html","contact/index.html","careers.html",
"careers/index.html","legal.html","legal/index.html","privacy.html","beta-terms.html"]
MARK='<script defer src="/assets/js/ga4-consent.js"></script>'
for name in PAGES:
 assert (ROOT/name).read_text(encoding="utf-8").count(MARK)==1,name
assert "G-KZSJ1W4PXH" in SOURCE
HTML='<!DOCTYPE html><html><head><title>Preview</title>'+MARK+'</head><body>Mock test</body></html>'
def intercept(page,requests):
 def handler(route):
  url=route.request.url
  if "/assets/js/ga4-consent.js" in url:
   route.fulfill(status=200,content_type="application/javascript",body=SOURCE)
  elif "googletagmanager.com" in url:
   requests.append(url)
   route.fulfill(status=200,content_type="application/javascript",body="")
  elif "groundworkbyable.online" in url:
   route.fulfill(status=200,content_type="text/html",body=HTML)
  else:
   raise AssertionError("Unexpected outgoing request")
 page.route("**/*",handler)

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True)
 try:
  context=browser.new_context()
  page=context.new_page()
  requests=[]
  intercept(page,requests)
  page.goto("https://groundworkbyable.online/?secret=not-for-analytics",wait_until="load")
  host=page.locator("#groundwork-consent-ui")
  assert host.locator(".panel").is_visible()
  assert requests==[]
  assert page.evaluate("typeof window.gtag")=="undefined"
  host.get_by_role("button",name="Decline analytics").click()
  page.reload(wait_until="load")
  assert requests==[]
  assert not host.locator(".panel").is_visible()
  host.get_by_role("button",name="Privacy choices").click()
  host.get_by_role("button",name="Allow analytics").click()
  page.wait_for_timeout(150)
  assert len(requests)==1,requests
  assert "G-KZSJ1W4PXH" in requests[0]
  data=page.evaluate("""() => Array.from(window.dataLayer||[], a => ({
   action:a[0],name:a[1],options: (typeof a[2]==='object'?JSON.parse(JSON.stringify(a[2])):a[2])
  }))""")
  assert data[0]["action"]=="consent" and data[0]["name"]=="default"
  assert data[0]["options"]["analytics_storage"]=="denied"
  assert data[1]["options"]["analytics_storage"]=="granted"
  for k in ("ad_storage","ad_user_data","ad_personalization"):
   assert data[1]["options"][k]=="denied"
  page_views=[x for x in data if x["action"]=="event" and x["name"]=="page_view"]
  assert len(page_views)==1 and page_views[0]["options"]["page_location"]=="https://groundworkbyable.online/"
  assert "secret=not-for-analytics" not in str(data)
  page.reload(wait_until="load")
  page.wait_for_timeout(150)
  assert len(requests)==2
  host.get_by_role("button",name="Privacy choices").click()
  host.get_by_role("button",name="Decline analytics").click()
  page.wait_for_load_state("load")
  page.wait_for_timeout(150)
  assert page.evaluate("typeof window.gtag")=="undefined"
  assert len(requests)==2
  context.close()

  gpc=browser.new_context()
  page=gpc.new_page()
  page.add_init_script("Object.defineProperty(navigator, 'globalPrivacyControl', {value:true})")
  seen=[]
  intercept(page,seen)
  page.goto("https://groundworkbyable.online/",wait_until="load")
  host=page.locator("#groundwork-consent-ui")
  assert seen==[]
  host.get_by_role("button",name="Privacy choices").click()
  assert host.get_by_role("button",name="Allow analytics").is_disabled()
  gpc.close()
 finally:
  browser.close()
print("PASS: default-off, decline, opt-in, sanitized page view, consent withdrawal, GPC")
print("NO LIVE TRACKING: all Google and Groundwork requests mocked in isolated Chromium")
