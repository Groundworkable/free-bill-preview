"""Read-only, local review guard. Does not publish, send, or change anything."""
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"preorder/PRIVACY_POLICY_V2_COMPLETE_CANDIDATE_2026-11-14.md"
PREVIEW=ROOT/".github/internal-legal-review/privacy-policy-v2.review-only.html"
PUBLIC=ROOT/"privacy.html"
CHECKOUT=ROOT/"preorder/checkout-config.json"

source=SOURCE.read_text(encoding="utf-8")
preview=PREVIEW.read_text(encoding="utf-8")
assert "FOUNDER-APPROVED PRIVACY-V2 WORDING" in source
assert "NOT PUBLISHED OR EFFECTIVE" in source

header="\n## Privacy Policy — proposed public copy\n"
footer="\n---\n\n## INTERNAL PUBLICATION CHECKS — NOT CUSTOMER COPY"
assert source.count(header)==1 and source.count(footer)==1
copy=source.split(header,1)[1].split(footer,1)[0].strip()

# Only strip Markdown presentation syntax present in the approved source.
def strip_markdown(text):
    text=re.sub(r"^###\s+","",text,flags=re.MULTILINE)
    text=re.sub(r"^-\s+","",text,flags=re.MULTILINE)
    text=text.replace("**","")
    text=re.sub(r"\*([^*]+)\*",r"\1",text)
    return " ".join(text.split())

class ArticleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_article=False
        self.depth=0
        self.text=[]
        self.sections=0
        self.links=0
    def handle_starttag(self,tag,attrs):
        if tag=="article":
            assert not self.in_article,"Unexpected nested article"
            self.in_article=True
            self.depth=1
            return
        if self.in_article:
            if tag=="h2":
                self.sections+=1
            if tag=="a":
                self.links+=1
    def handle_endtag(self,tag):
        if tag=="article":
            assert self.in_article
            self.in_article=False
    def handle_data(self,data):
        if self.in_article:
            self.text.append(data)

parser=ArticleText()
parser.feed(preview)
actual=" ".join("".join(parser.text).split())
expected=strip_markdown(copy)
assert actual==expected, (
    "Internal Privacy V2 preview drifted from founder-approved Markdown source. "
    "Do NOT publish or edit approved source to force a pass."
)
assert parser.sections==13,parser.sections
assert parser.links==0,"Preview must not inject external/live action links"
assert 'name="robots" content="noindex,nofollow,noarchive"' in preview
assert "NOT LEGAL PUBLICATION" in preview
assert "NOT EFFECTIVE" in preview
assert "Effective date: NOT SET" in preview
assert "https://buy.stripe.com" not in preview
assert "privacy-v1" in PUBLIC.read_text(encoding="utf-8")
checkout=CHECKOUT.read_text(encoding="utf-8")
assert '"enabled": false' in checkout
assert '"termsApproved": false' in checkout
print("PASS: Privacy V2 internal HTML text exactly matches approved review copy; publication and checkout remain closed")
