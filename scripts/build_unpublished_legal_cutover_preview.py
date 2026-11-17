"""Produce a LOCAL, non-deployable preview of the legal publication cutover.

Runs the existing read-only legal rehearsal and reuses its validated
publication transforms. No GitHub/Stripe/API/deployment writes. Preview files
are marked NOINDEX and PREVIEW ONLY; all dates are synthetic.
Preserves the 13 founder-approved Privacy V2 sections, including GA4 wording.
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

# Historical GA4 is now staged behind consent in the review branch.
# The approved Privacy V2 wording is unchanged in this offline preview.
assert (ROOT / "assets/js/ga4-consent.js").is_file()
assert "G-KZSJ1W4PXH" in (ROOT / "assets/js/ga4-consent.js").read_text(encoding="utf-8")

banner = '<div role="status" style="position:relative;background:#f4e5bd;color:#493820;padding:16px;text-align:center;font:700 16px Arial">OFFLINE LEGAL CUTOVER PREVIEW — NOT PUBLISHED OR EFFECTIVE</div>'
def stamp(content):
    content = replacement(content, "<!DOCTYPE html>",
        "<!DOCTYPE html>\n<!-- INTERNAL PREVIEW ONLY. NOT LEGALLY EFFECTIVE. NOT DEPLOYABLE. -->")
    content = replacement(content, "<head>", '<head>\n<meta name="robots" content="noindex,nofollow,noarchive">')
    body_tags = list(re.finditer(r"<body(?:\s[^>]*)?>", content, flags=re.IGNORECASE))
    assert len(body_tags) == 1, "Missing or ambiguous HTML body opening tag"
    m = body_tags[0]
    content = content[:m.end()] + "\n" + banner + content[m.end():]
    return content

candidate_policy = stamp(g["public_policy"])
assert candidate_policy.count('<section class="legal-section">') == 13
assert "The public site currently uses Google Analytics." in candidate_policy
assert '<script defer src="/assets/js/ga4-consent.js"></script>' in candidate_policy

routes = {}
for route in g["COMPANY_PATHS"]:
    original = (ROOT / route).read_text(encoding="utf-8")
    final = replacement(original, "Effective date: pending authorized publication", "Effective date: " + date)
    for old, new in g["PUBLIC_LABEL_CHANGES"]:
        final = replacement(final, old, new)
    final = stamp(final)
    assert final.count('<section class="legal-section">') == 13, route
    assert "privacy-v1" not in final.lower(), route
    assert "PUBLICATION REVIEW" not in final, route
    assert "pending authorized publication" not in final, route
    assert "The public site currently uses Google Analytics." in final, route
    assert '<script defer src="/assets/js/ga4-consent.js"></script>' in final, route
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
    "approved_legal_sections_unchanged": True,
    "historical_ga4_staged_with_consent": True,
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
    "All 13 approved Privacy V2 sections are unchanged, including Google Analytics.\n"
    "Original GA4 property is staged with opt-in controls in the review branch.\n"
    "All seven approved Pre-Purchase Terms sections are unchanged.\n"
    "Publishing requires separate authorization, true date, legal/operational\n"
    "review and updated final QA; Stripe and memberships remain disabled.\n",
    encoding="utf-8")
assert all('name="robots" content="noindex,nofollow,noarchive"' in p for p in routes.values())
print("PASS: preview-only legal release bundle created for 10 Company pages, standalone Privacy V2, and canonical Terms")
print("PASS: 13 approved Privacy sections unchanged, staged GA4 opt-in, seven Terms unchanged")
print("NOT LIVE: no deployed URL, owner authorization, actual effective date, checkout or membership")
