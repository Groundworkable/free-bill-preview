"""Groundwork payment legal publication safety check: review only, never activates checkout."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
published = (root / "privacy.html").read_text(encoding="utf-8")
company = (root / "contact/index.html").read_text(encoding="utf-8")
privacy_review = (root / "preorder/PRIVACY_V2_PREPURCHASE_REVIEW_2026-11-14.md").read_text(encoding="utf-8")
terms_review = (root / "preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md").read_text(encoding="utf-8")
gate = json.loads((root / "preorder/checkout-config.json").read_text(encoding="utf-8"))

# Detect silent revision of the existing public policy or Company legal viewer.
assert "Version: privacy-v1" in published and "Effective October 3, 2026" in published
assert "privacy-v1" in company and "October 3, 2026" in company
assert "Stripe" not in published, "The public policy was modified without a reviewed v2 release"

# Proposed legal materials must never be mistaken for effective terms.
assert "NOT PUBLISHED" in privacy_review and "NOT PUBLISHED" in terms_review
assert "billing@groundworkbyable.com" in privacy_review and "billing@groundworkbyable.com" in terms_review
assert "refund" in terms_review.lower() and "January 15, 2027" in terms_review
assert "purchased months 2–12" in terms_review and "February 2027" in terms_review
assert "Stripe" in privacy_review

# Explicit fail-closed checkout is independent of the existence of review drafts.
assert gate["enabled"] is False and gate["termsApproved"] is False
assert gate["termsUrl"] is None and gate["refundPolicyUrl"] is None
assert all(offer["paymentLink"] is None for offer in gate["offers"].values())
print("PASS: public privacy-v1 preserved, legal drafts flagged, and checkout remains disabled")
