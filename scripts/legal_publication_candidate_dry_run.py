"""Groundwork legal release candidate rehearsal. READ-ONLY and NEVER publishes.

Simulates the core legal publication transformations in memory, verifying the
approved policy articles and the customer-facing Terms remain byte-for-byte
unaltered. This is not permission to merge, release, or activate checkout.
"""
from pathlib import Path
from html.parser import HTMLParser
import re
import json

ROOT = Path(__file__).resolve().parents[1]
COMPANY_ROUTES = [
    "contact/index.html", "contact.html", "about/index.html", "about.html",
    "faqs/index.html", "faqs.html", "legal/index.html", "legal.html",
    "careers/index.html", "careers.html",
]
PRIVACY = ROOT / "privacy.html"
TERMS = ROOT / "review/prepurchase-terms.html"
CHECKOUT = ROOT / "preorder/checkout-config.json"
SYNTHETIC_DATE = "2099-01-01-DRY-RUN-NOT-AN-EFFECTIVE-DATE"
POLICY_MARKER = '<div class="kicker">Groundwork · Privacy</div>'

def exactly_once(source, old, new):
    assert source.count(old) == 1, "Missing or repeated required release field: " + old[:100]
    return source.replace(old, new)

def html_text(content):
    class TextOnly(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.text = []
        def handle_data(self, data):
            self.text.append(data)
    reader = TextOnly()
    reader.feed(content)
    return " ".join("".join(reader.text).split())

def policy_article(text, embedded):
    start = text.index(POLICY_MARKER)
    end = text.index("\n\n </div></dialog>", start) if embedded else text.index('<div class="legal-links">', start)
    return text[start:end].strip()

policy = PRIVACY.read_text(encoding="utf-8")
terms = TERMS.read_text(encoding="utf-8")
# PR #20 is intentionally separate from draft payment PR #17, which owns
# preorder/checkout-config.json. Absence here is expected: no checkout
# artifact is introduced or enabled by this legal-only branch.
if CHECKOUT.exists():
    config = json.loads(CHECKOUT.read_text(encoding="utf-8"))
    assert not config["enabled"] and not config["termsApproved"]
    assert config["termsUrl"] is None and config["refundPolicyUrl"] is None
    assert all(offer["paymentLink"] is None for offer in config["offers"].values())
else:
    assert not (ROOT / "preorder").exists(), (
        "The legal-only PR unexpectedly added preorder/ without the fail-closed configuration"
    )
    config = None

assert "Version: privacy-v2" in policy
assert "Effective date: pending authorized publication" in policy
assert policy.count('<section class="legal-section">') == 13
assert "PREPUBLICATION REVIEW — NOT EFFECTIVE" in terms
assert 'name="robots" content="noindex,nofollow,noarchive"' in terms
assert "Version and effective date:</strong> To be assigned when publication is authorized." in terms
assert terms.count("<h2>") == 7
assert "No automatic renewal is authorized" in terms
assert "January 15, 2027" in terms

approved_policy_body = policy_article(policy, embedded=False)
terms_body_start = terms.index("<h2>1. What you are buying</h2>")
terms_body_end = terms.index("</article>", terms_body_start)
approved_terms_sections = terms[terms_body_start:terms_body_end]

# The synthetic date has no legal effect and is never written anywhere.
updated_policy = exactly_once(
    policy,
    "Effective date: pending authorized publication",
    "Effective date: " + SYNTHETIC_DATE,
)
assert updated_policy.count('<section class="legal-section">') == 13
assert html_text(policy_article(updated_policy, False)).replace(SYNTHETIC_DATE, "") == (
    html_text(approved_policy_body).replace("pending authorized publication", "")
), "Publication preview changed the approved policy article"

for route in COMPANY_ROUTES:
    original = (ROOT / route).read_text(encoding="utf-8")
    assert "Effective date: pending authorized publication" in original, route
    assert original.count('<section class="legal-section">') == 13, route
    assert re.sub(r"\s+", " ", policy_article(original, True)) == re.sub(
        r"\s+", " ", approved_policy_body
    ), "Current embedded approved policy differs: " + route
    future = exactly_once(
        original,
        "Effective date: pending authorized publication",
        "Effective date: " + SYNTHETIC_DATE,
    )
    assert SYNTHETIC_DATE in future and "pending authorized publication" not in future, route
    assert future.count('<section class="legal-section">') == 13, route

# Rehearse only the wrapper/metadata transformation for Terms. The seven
# approved terms sections MUST be identical. This does not silently authorize
# their publication or enable purchases.
future_terms = exactly_once(
    terms, 'name="robots" content="noindex,nofollow,noarchive"',
    'name="robots" content="index,follow"',
)
future_terms = exactly_once(
    future_terms, "Pre-Purchase Terms | Release Review Only",
    "Pre-Purchase Terms",
)
future_terms = exactly_once(
    future_terms,
    "PREPUBLICATION REVIEW — NOT EFFECTIVE · NO CHECKOUT OR PAYMENT ENABLED",
    "These terms are published in advance. Pre-purchases are not yet available.",
)
future_terms = exactly_once(
    future_terms,
    "Version and effective date:</strong> To be assigned when publication is authorized.",
    "Version and effective date:</strong> prepurchase-terms-v1 · " + SYNTHETIC_DATE,
)
future_terms = exactly_once(
    future_terms,
    "Unpublished review copy. Do not use this URL as a Stripe Terms of Service URL.",
    "One-time pre-purchases remain unavailable until separately enabled.",
)
assert future_terms.count("<h2>") == 7
a = future_terms.index("<h2>1. What you are buying</h2>")
b = future_terms.index("</article>", a)
assert future_terms[a:b] == approved_terms_sections, "Approved Terms sections changed"

# Explicit release blockers: this simulation cannot provide authorization,
# select a real effective date, establish a public URL, or make checkout live.
assert not (ROOT / "prepurchase-terms.html").exists(), (
    "Public Terms path now exists: review separately rather than overwriting it"
)
assert (ROOT / "review/prepurchase-terms.html").is_file()
assert PRIVACY.read_text(encoding="utf-8") == policy
assert TERMS.read_text(encoding="utf-8") == terms
assert config is None or config["enabled"] is False
print("PASS: dry-run legal candidate; 13 Privacy sections and 7 Terms sections preserved.")
print("NO PUBLICATION: synthetic date, no public Terms URL, review-only file remains, checkout disabled.")
print("Publication still requires approved effective date, removal of the review-only route,")
print("consistent postpublication trust/FAQ labels on all ten Company pages, and explicit owner authorization.")
