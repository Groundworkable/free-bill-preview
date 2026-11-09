"""Headless desktop/mobile checks for the approved Organizations pre-release page.

Runs against the PR's local HTML; does not submit email or activate sponsorships.
"""
from pathlib import Path
from urllib.parse import unquote
from playwright.sync_api import sync_playwright

PAGE_URL = (Path(__file__).resolve().parents[1] / "organizations.html").as_uri()
OFFERS = [
    ("pilot", "$450", "90-day pilot"),
    ("twentyfive", "$1,800", "Annual continuation"),
    ("fifty", "$3,000", "Annual access"),
    ("hundred", "$5,400", "Annual access"),
]


def check_page(browser, name, viewport):
    context = browser.new_context(viewport=viewport)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto(PAGE_URL, wait_until="load")

    assert "PRE-RELEASE" in page.locator(".edition").inner_text()
    assert page.locator("button.plan").count() == 3, "Approved three-card pricing layout changed"

    # Continue directly from welcome to the approved pricing experience.
    page.locator(".intro [data-jump='3']").click()
    assert page.locator(".scene.prices").get_attribute("aria-hidden") == "false"

    for key, price, label in OFFERS:
        page.locator(f"[data-plan='{key}']").click()
        assert page.locator(f"[data-plan='{key}']").get_attribute("aria-pressed") == "true"
        assert label in page.locator("#selectedPlanName").inner_text()
        assert price in page.locator("#selectedPlanCaption").inner_text()

        page.locator("#next").click()
        assert page.locator(".scene.finish").get_attribute("aria-hidden") == "false"
        assert price in page.locator("#briefPrice").inner_text()
        href = unquote(page.locator("#emailBrief").get_attribute("href"))
        assert href.startswith("mailto:") and price in href, "Email brief missing selected price"

        page.locator("#startInquiry").click()
        assert page.locator("#contactModal").is_visible()
        assert page.locator("#contactPlan").input_value() == key
        assert price in page.locator("#contactSummary").inner_text(), (key, repr(page.locator("#contactSummary").inner_text()), page.locator("#contactPlan").input_value())
        assert "email draft" in page.locator("#contactCopyAndEmail").inner_text().lower()
        assert "does not send inquiries" in page.locator("#contactStatus").inner_text().lower()
        page.locator("#closeContact").click()
        assert page.locator("#contactModal").is_hidden()
        page.locator("#prev").click()

    width = page.evaluate("document.documentElement.scrollWidth")
    assert width <= viewport["width"] + 3, (
        f"Horizontal overflow on {name}: document {width}px; viewport {viewport['width']}px"
    )
    assert not errors, f"Browser JavaScript errors on {name}: {errors}"
    print(f"PASS {name}: pricing, brief, mailto destination, inquiry, modal, responsive width")
    context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    try:
        check_page(browser, "desktop", {"width": 1440, "height": 900})
        check_page(browser, "mobile", {"width": 390, "height": 844})
    finally:
        browser.close()
