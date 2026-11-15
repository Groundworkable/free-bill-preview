"""Groundwork payment legal publication safety check: review only, never activates checkout."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
published = (root / "privacy.html").read_text(encoding="utf-8")
company = (root / "contact/index.html").read_text(encoding="utf-8")
privacy_review = (root / "preorder/PRIVACY_V2_PREPURCHASE_REVIEW_2026-11-14.md").read_text(encoding="utf-8")
terms_review = (root / "preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md").read_text(encoding="utf-8")
privacy_candidate = (root / "preorder/PRIVACY_POLICY_V2_COMPLETE_CANDIDATE_2026-11-14.md").read_text(encoding="utf-8")
gate = json.loads((root / "preorder/checkout-config.json").read_text(encoding="utf-8"))

# Detect silent revision of the existing public policy or Company legal viewer.
assert "Version: privacy-v1" in published and "Effective October 3, 2026" in published
assert "privacy-v1" in company and "October 3, 2026" in company
assert "Stripe" not in published, "The public policy was modified without a reviewed v2 release"

# The Company & Information modal embeds the full published privacy text.
# Detect drift in ANY customer-facing paragraph, not just the version/date label.
# Only tolerate whitespace differences between standalone and embedded markup.
import re

marker = '<div class="kicker">Groundwork · Privacy</div>'
public_start = published.index(marker)
public_end = published.index('<div class="legal-links">', public_start)
modal_start = company.index('<dialog id="gwPolicyDialog"')
embedded_start = company.index(marker, modal_start)
embedded_end = company.index('\n</section>', embedded_start)

def normalized_policy_markup(source: str) -> str:
    return re.sub(r"\\s+", " ", source).strip()

standalone_policy = normalized_policy_markup(published[public_start:public_end])
embedded_policy = normalized_policy_markup(company[embedded_start:embedded_end])
assert standalone_policy == embedded_policy, (
    "Company & Information privacy reader drifted from privacy.html; "
    "both public-policy locations must remain synchronized"
)
assert standalone_policy.count('<section class="legal-section">') == 12

# Proposed legal materials must never be mistaken for effective terms.
assert "NOT PUBLISHED" in privacy_review and "NOT PUBLISHED" in terms_review
assert "billing@groundworkbyable.com" in privacy_review and "billing@groundworkbyable.com" in terms_review
assert "refund" in terms_review.lower() and "January 15, 2027" in terms_review
assert "purchased months 2–12" in terms_review and "February 2027" in terms_review
assert "Stripe" in privacy_review
assert "NOT PUBLISHED" in privacy_candidate and "privacy-v2" in privacy_candidate
assert "privacy-v1" in privacy_candidate and "NOT PUBLISHED OR EFFECTIVE" in privacy_candidate
for disclosure in (
    "Stripe", "Cloudflare", "Supabase", "Google Analytics",
    "billing@groundworkbyable.com", "support@groundworkbyable.com",
    "hello@groundworkbyable.com", "no single promised deletion period",
    "does **not** store the buyer's email address",
    "does **not** authorize recurring charges"
):
    assert disclosure in privacy_candidate, disclosure


# Explicit fail-closed checkout is independent of the existence of review drafts.
assert gate["enabled"] is False and gate["termsApproved"] is False
assert gate["termsUrl"] is None and gate["refundPolicyUrl"] is None
assert all(offer["paymentLink"] is None for offer in gate["offers"].values())
print("PASS: public privacy-v1 preserved, legal drafts flagged, and checkout remains disabled")
