"""Produce a LOCAL, non-deployable preview of the legal publication cutover.

Runs the existing read-only legal rehearsal and reuses its validated
publication transforms. No GitHub/Stripe/API/deployment writes. Preview files
are marked NOINDEX and PREVIEW ONLY; all dates are synthetic.
Two GA sentences are *proposals only* until separately approved by the owner.
"""
import json
import re
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "groundwork-legal-cutover-PREVIEW-ONLY"
if OUT.exists():
    raise SystemExit("Refusing to overwrite an existing preview directory")
assert not (ROOT / "preorder/checkout-config.json").exists(), (
    "Review candidate must not contain draft payment activation configuration"
)
g = runpy.run_path(str(ROOT / "scripts/legal_publication_full_rehearsal.py"))
replacement = g["replace_exact"]
date = g["DATE"]
assert "SYNTHETIC" in date and "NOT-EFFECTIVE" in date
assert g["TERMS_VERSION"] == "prepurchase-terms-v1"
terms_approved = g["approved_terms_sections"]

# These are an UNAPPROVED, narrowly scoped accuracy proposal, never an edit to
# the original 13 approved sections. Every change is independently counted.
ga_proposal = (
    (
        "The public site currently uses Google Analytics.",
        "The public site may use Google Analytics when it is enabled.",
    ),
    (
        "The public site currently uses Google Analytics to understand general visitor activity.",
        "When enabled, Google Analytics may be used to understand general visitor activity.",
    ),
)
original_policy = (ROOT / "privacy.html").read_text(encoding="utf-8")
assert all(original_policy.count(old) == 1 for old, _ in ga_proposal)

banner = '<div role="status" style="position:relative;background:#f4e5bd;color:#493820;padding:16px;text-align:center;font:700 16px Arial">OFFLINE LEGAL CUTOVER PREVIEW — NOT PUBLISHED OR EFFECTIVE — PROPOSED GA WORDING IS NOT APPROVED</div>'
def stamp(content):
    content = replacement(content, "<!DOCTYPE html>",
        "<!DOCTYPE html>\n<!-- INTERNAL PREVIEW ONLY. NOT LEGALLY EFFECTIVE. NOT DEPLOYABLE. -->")
    content = replacement(content, "<head>", '<head>\n<meta name="robots" content="noindex,nofollow,noarchive">')
    body_tags = list(re.finditer(r"<body(?:\\s[^>]*)?>", content, flags=re.IGNORECASE))\n    assert len(body_tags) == 1, "Missing or ambiguous HTML body opening tag"\n    m = body_tags[0]\n    content = content[:m.end()] + "\\n" + banner + content[m.end():]
    return content

def apply_proposal(content):
    for old, new in ga_proposal:
        content = replacement(content, old, new)
    return content

candidate_policy = stamp(apply_proposal(g["public_policy"]))
assert candidate_policy.count('<section class="legal-section">') == 13
assert "currently uses Google Analytics" not in candidate_policy

routes = {}
for route in g["COMPANY_PATHS"]:
    original = (ROOT / route).read_text(encoding="utf-8")
    final = replacement(original, "Effective date: pending authorized publication", "Effective date: " + date)
    for old, new in g["PUBLIC_LABEL_CHANGES"]:
        final = replacement(final, old, new)
    final = stamp(apply_proposal(final))
    assert final.count('<section class="legal-section">') == 13, route
    assert "privacy-v1" not in final.lower(), route
    assert "PUBLICATION REVIEW" not in final, route
    assert "pending authorized publication" not in final, route
    assert "currently uses Google Analytics" not in final, route
    routes[route] = final
routes["privacy.html"] = candidate_policy

# Exact seven terms sections from the founder-approved original.
terms = g["published_terms"]
terms = replacement(terms, 'name="robots" content="index,follow"',
                    'name="robots" content="noindex,nofollow,noarchive"')
terms = replacement(terms, "<head>", '<head>\n<!-- INTERNAL PREVIEW; DO NOT USE AS TERMS AGREEMENT URL -->')
terms = replacement(terms, "<body>", "<body>\n" + banner)
s = terms.index("<h2>1. What you are buying</h2>")
e = terms.index("</article>", s)
assert terms[s:e] == terms_approved, "Approved Terms sections changed in preview"
assert "NOT PUBLISHED" in terms and date in terms
routes["prepurchase-terms/index.html"] = terms

# The generator writes ONLY under an isolated non-deployable preview folder.
for relative, content in routes.items():
    dest = OUT / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding="utf-8")
manifest = {
    "status": "LOCAL_PREVIEW_NOT_EFFECTIVE_NOT_DEPLOYABLE",
    "date": date,
    "terms_version": g["TERMS_VERSION"],
    "privacy_sections": 13,
    "terms_sections": 7,
    "company_route_copies": len(g["COMPANY_PATHS"]),
    "preview_file_count": len(routes),
    "approved_legal_sections_unchanged_except_unapproved_ga_proposal": True,
    "ga_proposal_review_required": True,
    "public_terms_route_published": False,
    "stripe_test_link_consent_enabled": False,
    "live_payments_enabled": False,
    "all_output_pages_noindex": True,
    "files": sorted(routes),
}
(OUT / "PREVIEW_MANIFEST.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
(OUT / "READ_FIRST.txt").write_text(
    "GROUNDWORK LEGAL CUTOVER — OFFLINE REVIEW ONLY\n\n"
    "Every HTML page is labeled NOT PUBLISHED OR EFFECTIVE and has noindex.\n"
    "The date is synthetic; NEVER upload these files to production.\n"
    "Privacy V2's two Google Analytics sentences have UNAPPROVED hypothetical\n"
    "conditional wording in this preview; the current approved sources are untouched.\n"
    "All seven approved Pre-Purchase Terms sections are unchanged.\n"
    "Publishing requires separate authorization, true date, legal/operational\n"
    "review and updated final QA; Stripe and memberships remain disabled.\n",
    encoding="utf-8")
assert all('name="robots" content="noindex,nofollow,noarchive"' in p for p in routes.values())
print("PASS: preview-only legal release bundle created for 10 Company pages, standalone Privacy V2, and canonical Terms")
print("PASS: 13 privacy sections on all pages; seven unchanged Terms sections; two GA wording edits proposed only")
print("NOT LIVE: no deployed URL, owner authorization, actual effective date, checkout or membership")
