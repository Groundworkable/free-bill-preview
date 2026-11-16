"""Read-only Privacy V2 dual-surface publication DRY RUN.

Uses the already source-verified nonpublic HTML review article to construct
*in-memory only* previews for both existing privacy presentation surfaces.
No files are written, no effective date assigned, and no live policy is changed.
This is an engineering rehearsal, not legal approval or publication authority.
"""
from html.parser import HTMLParser
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
PRIVACY_PATH = ROOT / "privacy.html"
COMPANY_PATH = ROOT / "contact/index.html"
REVIEW_PATH = ROOT / ".github/internal-legal-review/privacy-policy-v2.review-only.html"
CHECKOUT_PATH = ROOT / "preorder/checkout-config.json"

privacy = PRIVACY_PATH.read_text(encoding="utf-8")
company = COMPANY_PATH.read_text(encoding="utf-8")
review = REVIEW_PATH.read_text(encoding="utf-8")
checkout = json.loads(CHECKOUT_PATH.read_text(encoding="utf-8"))

assert checkout["enabled"] is False and checkout["termsApproved"] is False
assert checkout["termsUrl"] is None and checkout["refundPolicyUrl"] is None
assert all(x["paymentLink"] is None for x in checkout["offers"].values())

# Preserve the existing, verified public v1, including its embedded legal reader.
MARKER = '<div class="kicker">Groundwork · Privacy</div>'
public_start = privacy.index(MARKER)
public_end = privacy.index('<div class="legal-links">', public_start)
dialog_start = company.index('<dialog id="gwPolicyDialog"')
embedded_start = company.index(MARKER, dialog_start)
embedded_end = company.index("\n</section>", embedded_start) + len("\n</section>")
assert privacy.count(MARKER) == 1
assert company.count(MARKER) == 1
assert "Version: privacy-v1" in privacy[public_start:public_end]
assert "Version: privacy-v1" in company[embedded_start:embedded_end]
assert "October 3, 2026" in privacy[public_start:public_end]
assert "October 3, 2026" in company[embedded_start:embedded_end]

def compressed_markup(t: str) -> str:
    return re.sub(r"\s+", " ", t).strip()

# The modal's existing block is the same v1 copy with a closing wrapper.
baseline_pub = compressed_markup(privacy[public_start:public_end])
baseline_embed = compressed_markup(company[embedded_start:embedded_end])
assert baseline_pub == baseline_embed, "Current public and embedded Privacy V1 diverged"

# Reviewed V2 contains the verbatim, founder-approved text, guarded independently
# by privacy_v2_preview_parity.test.py. Never pull metadata / a title from this file.
assert "NOT LEGAL PUBLICATION" in review
assert "Effective date: NOT SET" in review
assert 'name="robots" content="noindex,nofollow,noarchive"' in review
a = review.index("<article>") + len("<article>")
b = review.index("</article>", a)
article = review[a:b].strip()
parts = re.split(r"(?=<h2>)", article)
assert len(parts) == 14, "Expected two intro paragraphs plus 13 numbered sections"
intro, numbered = parts[0], parts[1:]
assert intro.count("<p>") == 2
assert all(part.lstrip().startswith("<h2>") for part in numbered)
assert "privacy-v1" not in article

# Replace only the matching policy *body* within in-memory text; intentionally do
# not write the output or claim approval of the accompanying navigation/FAQ copy.
# The real publication PR must assign the real effective date at publication time.
META = ('<div class="legal-meta"><span>Version: privacy-v2</span>'
        '<span>Effective date: AWAITING AUTHORIZED PUBLICATION</span>'
        '<span>Operator: Able Systems LLC</span></div>')
sections = "\n".join(
    '<section class="legal-section">' + fragment.strip() + '</section>'
    for fragment in numbered
)
new_policy = "\n".join((
    MARKER, "<h1>Privacy Policy</h1>", META, intro.strip(), sections,
)) + "\n"

proposed_public = privacy[:public_start] + new_policy + privacy[public_end:]
proposed_company = company[:embedded_start] + new_policy.rstrip() + company[embedded_end:]

pub_start = proposed_public.index(MARKER)
pub_end = proposed_public.index('<div class="legal-links">', pub_start)
mod_start = proposed_company.index(MARKER, proposed_company.index('<dialog id="gwPolicyDialog"'))
mod_end = mod_start + len(new_policy.rstrip())
assert compressed_markup(proposed_public[pub_start:pub_end]) == compressed_markup(
    proposed_company[mod_start:mod_end]
), "In-memory generated V2 blocks drifted"

class ExtractText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.capture = False
        self.parts = []
    def handle_starttag(self, tag, attrs):
        if tag == "article":
            self.capture = True
    def handle_endtag(self, tag):
        if tag == "article":
            self.capture = False
    def handle_data(self, data):
        if self.capture:
            self.parts.append(data)

def text_inside_article(source: str) -> str:
    parser = ExtractText()
    parser.feed(source)
    return " ".join("".join(parser.parts).split())

def text_without_tags(source: str) -> str:
    class Strip(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.parts = []
        def handle_data(self, data):
            self.parts.append(data)
    parser = Strip()
    parser.feed(source)
    return " ".join("".join(parser.parts).split())

expected = text_inside_article(review)
constructed = text_without_tags(intro + sections)
assert expected == constructed, "Constructed Privacy V2 section text changed"

# The V1 legal page has a legacy plain-language summary and FAQ/trust copy
# outside the modal. Do not silently reuse or rewrite those unapproved strings.
assert new_policy.count('<section class="legal-section">') == 13
assert proposed_public.count("Version: privacy-v1") == 0
assert proposed_company.count("Version: privacy-v1") == 0
# These are specifically the modal 'source transcript' label and a FAQ answer,
# and must be reviewed together when a real legal publication is approved.
outside_v1_refs = proposed_company.count("privacy-v1")
assert outside_v1_refs == 2, (
    "Unexpected V1 references in the hypothetical Company page; "
    "audit trust/FAQ/source labels before publication"
)
assert "Effective date: AWAITING AUTHORIZED PUBLICATION" in new_policy
assert "Effective October 3, 2026" not in new_policy
assert "<script" not in new_policy and "https://buy.stripe.com" not in new_policy
assert "<a " not in new_policy, "Do not inject links into approved policy article"

# The source repository remains exactly unchanged; no writes anywhere in script.
assert PRIVACY_PATH.read_text(encoding="utf-8") == privacy
assert COMPANY_PATH.read_text(encoding="utf-8") == company
assert REVIEW_PATH.read_text(encoding="utf-8") == review

print(
    "PASS: generated in-memory Privacy V2 for two synchronized surfaces; "
    "13 exact-text sections; real V1 and checkout remain unchanged. "
    f"Outstanding: {outside_v1_refs} legacy Company-page privacy-v1 labels, "
    "true effective date, explicit legal and publication authorization."
)
