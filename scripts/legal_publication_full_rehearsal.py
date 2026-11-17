"""Simulate the complete Privacy V2 + one-time Terms publication in memory.

NEVER WRITES FILES, NEVER PUBLISHES, NEVER CONNECTS CHECKOUT.
Approved customer legal sections are preserved exactly. Production publication
requires separately recorded owner authorization and actual version/date.
"""
from pathlib import Path
from html.parser import HTMLParser
from hashlib import sha256
import re

ROOT = Path(__file__).resolve().parents[1]
DATE = "2099-01-01-SYNTHETIC-DRY-RUN-NOT-EFFECTIVE"
TERMS_VERSION = "prepurchase-terms-v1"
POLICY_MARKER = '<div class="kicker">Groundwork · Privacy</div>'
COMPANY_PATHS = (
    "contact/index.html", "contact.html", "about/index.html", "about.html",
    "faqs/index.html", "faqs.html", "legal/index.html", "legal.html",
    "careers/index.html", "careers.html",
)
def load(path):
    return (ROOT / path).read_text(encoding="utf-8")

def replace_exact(content, before, after):
    n = content.count(before)
    assert n == 1, f"Expected one candidate replacement, got {n}: {before[:90]}"
    return content.replace(before, after)

def normalize(content):
    return re.sub(r"\s+", " ", content).strip()

def policy_article(content, embedded=False):
    start = content.index(POLICY_MARKER)
    end_marker = "\n\n </div></dialog>" if embedded else '<div class="legal-links">'
    end = content.index(end_marker, start)
    return content[start:end].strip()

# These are ONLY status, metadata, navigation and explanatory text changes.
# Do not change text within the 13 legal sections or seven approved Terms sections.
PUBLIC_LABEL_CHANGES = (
    (
        "Able Systems currently publishes Privacy V1, effective October 3, 2026, covering public-site and invitation-only beta data. Privacy V2 remains a prepublication review until its authorized effective date.",
        "Able Systems publishes Privacy V2, effective " + DATE + ", covering public-site and invitation-only beta data."
    ),
    (
        "PRIVACY V2 · PUBLICATION REVIEW · NOT YET EFFECTIVE",
        "PUBLISHED SOURCE · PRIVACY-V2 · EFFECTIVE " + DATE
    ),
    (
        "Policy exists · public-launch update review",
        "Privacy V2 · published with effective date"
    ),
    (
        "Privacy V2 is prepared but not yet effective. Privacy V1 remains the published policy until an authorized publication cutover.",
        "Privacy V2 is the published Privacy Policy. Review it for current data practices and customer choices."
    ),
    (
        "Current public policy: /privacy.html · check effective date",
        "Published Privacy Policy: /privacy.html · effective " + DATE
    ),
    (
        "Privacy V2 is under review; Privacy V1 remains effective until authorized publication. Private Beta Terms are separate. Pre-purchase terms must be public before checkout opens.",
        "Privacy V2 is published. Private Beta Terms and the published Pre-Purchase Terms remain separate; checkout stays disabled until separately authorized."
    ),
    (
        '"state":"PRIVACY V2 · PUBLICATION REVIEW"',
        '"state":"PUBLISHED PRIVACY POLICY · V2"'
    ),
    (
        '"tag":"V1 remains effective"',
        '"tag":"Privacy V2 effective ' + DATE + '"'
    ),
    (
        '"explain":"Privacy V2 is prepared for review but is not yet effective. The public website continues to use its published Privacy V1 until an authorized publication cutover."',
        '"explain":"Groundwork publishes Privacy V2 for the public website and invitation-only beta. Review the current policy and effective date."'
    ),
    (
        '"next":"Check the currently effective public policy for present practices. Privacy V2 will become effective only when separately authorized and published."',
        '"next":"Privacy V2 is effective. Review its data practices and customer choices; future features may require new notices."'
    ),
    (
        '"loc":"Effective policy: groundworkbyable.online/privacy.html (Privacy V1)"',
        '"loc":"Official policy: groundworkbyable.online/privacy.html (Privacy V2)"'
    ),
    (
        "Read Privacy V2 review ↗",
        "Read published Privacy V2 ↗"
    ),
    (
        "Check the public Privacy page for the effective policy version and date. This embedded Privacy V2 text is a prepublication draft until authorized.",
        "The published Privacy V2 is also available on the standalone Privacy page, which is the authoritative public version."
    ),
    (
        "Check public policy ↗",
        "Published policy ↗"
    ),
)

original_policy = load("privacy.html")
review_terms = load("review/prepurchase-terms.html")
assert original_policy.count('<section class="legal-section">') == 13
assert review_terms.count("<h2>") == 7
assert "Effective date: pending authorized publication" in original_policy
assert 'name="robots" content="noindex,nofollow,noarchive"' in review_terms

# Simulated public policy; actual live policy stays untouched.
public_policy = replace_exact(
    original_policy, "Effective date: pending authorized publication",
    "Effective date: " + DATE
)
assert public_policy.count('<section class="legal-section">') == 13
old_sections = original_policy[original_policy.index('<section class="legal-section">'):original_policy.rindex("</section>")+len("</section>")]
new_sections = public_policy[public_policy.index('<section class="legal-section">'):public_policy.rindex("</section>")+len("</section>")]
assert old_sections == new_sections, "Approved Privacy V2 legal text modified"
assert "The public site currently uses Google Analytics." in public_policy, "Do not silently rewrite approved analytics claim"

# Simulate every Company route, not just /contact/. Dynamic privacy selector
# and static labels must both describe the legally published V2 in final bundle.
for route in COMPANY_PATHS:
    original = load(route)
    updated = replace_exact(
        original, "Effective date: pending authorized publication",
        "Effective date: " + DATE
    )
    for before, after in PUBLIC_LABEL_CHANGES:
        updated = replace_exact(updated, before, after)
    assert normalize(policy_article(updated, True)) == normalize(policy_article(public_policy)), route
    assert updated.count('<section class="legal-section">') == 13, route
    assert 'privacy-v1' not in updated.lower(), f"Old policy label remained in {route}"
    assert "PUBLICATION REVIEW" not in updated, f"Review label remained in {route}"
    assert "prepublication" not in updated.lower(), f"Prepublication claim remained in {route}"
    assert 'rel="canonical"' in updated if route.endswith("/index.html") else True
    assert DATE in updated

# Simulated Terms public content at stable canonical path:
# https://groundworkbyable.online/prepurchase-terms/
# No route is actually created by this script.
terms_sections_start = review_terms.index("<h2>1. What you are buying</h2>")
terms_sections_end = review_terms.index("</article>", terms_sections_start)
approved_terms_sections = review_terms[terms_sections_start:terms_sections_end]
published_terms = replace_exact(
    review_terms, 'name="robots" content="noindex,nofollow,noarchive"',
    'name="robots" content="index,follow"'
)
published_terms = replace_exact(
    published_terms, "Pre-Purchase Terms | Release Review Only",
    "Pre-Purchase Terms"
)
published_terms = replace_exact(
    published_terms, "PREPUBLICATION REVIEW — NOT EFFECTIVE · NO CHECKOUT OR PAYMENT ENABLED",
    "These terms are published in advance. Pre-purchase checkout remains unavailable."
)
published_terms = replace_exact(
    published_terms,
    "Version and effective date:</strong> To be assigned when publication is authorized.",
    "Version and effective date:</strong> " + TERMS_VERSION + " · " + DATE
)
published_terms = replace_exact(
    published_terms,
    "Unpublished review copy. Do not use this URL as a Stripe Terms of Service URL.",
    "Pre-purchases remain unavailable until checkout is separately authorized."
)
published_terms = replace_exact(
    published_terms, "<title>Groundwork by Able — Pre-Purchase Terms</title>",
    '<title>Groundwork by Able — Pre-Purchase Terms</title>\n<link rel="canonical" href="https://groundworkbyable.online/prepurchase-terms/">'
)
assert published_terms.count("<h2>") == 7
start = published_terms.index("<h2>1. What you are buying</h2>")
end = published_terms.index("</article>", start)
assert published_terms[start:end] == approved_terms_sections, "Approved Terms content modified"
assert "PREPUBLICATION REVIEW" not in published_terms
assert DATE in published_terms and TERMS_VERSION in published_terms
assert not (ROOT / "prepurchase-terms").exists(), "Potential public route conflict"
assert not (ROOT / "prepurchase-terms.html").exists(), "Legacy Terms route conflict"

# Approved content fingerprint, not customer data and not a publication.
print("PASS: all ten Company pages simulate published V2 labels, date and identical 13-section legal text")
print("PASS: simulated /prepurchase-terms/ retains all seven approved Terms sections, with version and date")
print("PRIVACY_SECTIONS_SHA256=" + sha256(old_sections.encode("utf-8")).hexdigest())
print("TERMS_SECTIONS_SHA256=" + sha256(approved_terms_sections.encode("utf-8")).hexdigest())
print("NO WRITE / NO RELEASE: terms route does not exist, reviewed policy files unchanged, no checkout/payment activation")
print("REMAINING: truthful actual date, owner publication authorization, correct GA disclosure, operational/legal clearance")
