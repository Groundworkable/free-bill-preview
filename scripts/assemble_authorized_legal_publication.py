"""Assemble a *non-deployed* publication package with the final approved legal copy.

Default behavior performs in-memory rehearsal ONLY. A real-date package can
only be staged with independently documented founder publication authorization,
legal review evidence and a GA4 stream match. This command NEVER deploys,
merges, changes payment or Stripe, sends customer messages, or edits source.
"""
import argparse
import datetime as dt
import hashlib
import json
import re
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/legal_publication_full_rehearsal.py"
COMPANY_SCRIPT = '<script defer src="/assets/js/ga4-consent.js"></script>'
GA_ID = "G-KZSJ1W4PXH"
STAGING_NAME = "groundwork-LEGAL-PUBLICATION-STAGED-NOT-DEPLOYED"
TERMS_PATH = "prepurchase-terms/index.html"

def exactly(source, before, after):
    count = source.count(before)
    if count != 1:
        raise ValueError(f"Release template changed; expected one occurrence, found {count}: {before[:70]}")
    return source.replace(before, after)

def sections(body, marker, ending):
    i = body.index(marker)
    j = body.index(ending, i)
    return body[i:j]

def package(effective_date):
    # The existing simulation is the source of *approved text transforms*.
    # Neither script edits a file during this function.
    g = runpy.run_path(str(SCRIPT))
    dummy = g["DATE"]
    assert "SYNTHETIC" in dummy and effective_date != dummy
    assert GA_ID in (ROOT / "assets/js/ga4-consent.js").read_text(encoding="utf-8")
    assert not (ROOT / "preorder/checkout-config.json").exists(), (
        "Legal-only candidate unexpectedly includes checkout configuration"
    )
    assert effective_date != "" and re.fullmatch(r"\d{4}-\d{2}-\d{2}", effective_date)
    dt.date.fromisoformat(effective_date)
    files = {}
    policy = exactly(g["public_policy"], dummy, effective_date)
    assert policy.count('<section class="legal-section">') == 13
    assert COMPANY_SCRIPT in policy
    assert "privacy-v2" in policy
    original_policy = (ROOT / "privacy.html").read_text(encoding="utf-8")
    original_sections = sections(original_policy, '<section class="legal-section">', '<div class="legal-links">')
    published_sections = sections(policy, '<section class="legal-section">', '<div class="legal-links">')
    assert original_sections == published_sections, "Approved 13-section Privacy V2 changed"
    files["privacy.html"] = policy

    for path in g["COMPANY_PATHS"]:
        body = (ROOT / path).read_text(encoding="utf-8")
        body = exactly(body, "Effective date: pending authorized publication", "Effective date: " + effective_date)
        for before, after in g["PUBLIC_LABEL_CHANGES"]:
            body = exactly(body, before, after.replace(dummy, effective_date))
        assert COMPANY_SCRIPT in body, path
        assert body.count('<section class="legal-section">') == 13, path
        assert g["normalize"](g["policy_article"](body, True)) == g["normalize"](
            g["policy_article"](policy, False)), path
        for stale in ("pending authorized publication", "PRIVACY V2 · PUBLICATION REVIEW",
                      "V1 remains effective", "prepublication", "privacy-v1"):
            assert stale.lower() not in body.lower(), (path, stale)
        files[path] = body

    terms = exactly(g["published_terms"], dummy, effective_date)
    assert '<link rel="canonical" href="https://groundworkbyable.online/prepurchase-terms/">' in terms
    assert 'name="robots" content="index,follow"' in terms
    assert "prepurchase-terms-v1" in terms
    assert "PREPUBLICATION REVIEW" not in terms
    assert "To be assigned when publication is authorized" not in terms
    assert "Unpublished review" not in terms
    assert terms.count("<h2>") == 7
    approved = g["approved_terms_sections"]
    actual = sections(terms, '<h2>1. What you are buying</h2>', '</article>')
    assert approved == actual, "Approved 7-section Terms changed"
    # This is a contract, NOT a deployment. Current review page stays unchanged.
    files[TERMS_PATH] = terms

    assert len(files) == 12
    privacy_hash = hashlib.sha256(original_sections.encode()).hexdigest()
    terms_hash = hashlib.sha256(approved.encode()).hexdigest()
    return files, {
        "status": "STAGED_ONLY_NOT_DEPLOYED",
        "effective_date": effective_date,
        "privacy_version": "privacy-v2",
        "terms_version": "prepurchase-terms-v1",
        "privacy_sections": 13,
        "company_copies": 10,
        "terms_sections": 7,
        "privacy_approved_sections_sha256": privacy_hash,
        "terms_approved_sections_sha256": terms_hash,
        "ga4_measurement_id_from_history": GA_ID,
        "stripe_payment_link_changes": False,
        "checkout_enabled": False,
        "customer_notifications_enabled": False,
        "source_legal_review_route_is_not_authorized_as_terms": True,
        "files": sorted(files),
    }

def nonempty_evidence(value, label):
    if not value or not value.strip() or len(value.strip()) < 8:
        raise ValueError(f"Missing required {label}; no publication package created")
    if any(x in value.lower() for x in ("placeholder", "pending", "synthetic", "tbd", "example")):
        raise ValueError(f"Not acceptable as {label}: placeholder values are blocked")
    return value.strip()

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true", help="In-memory simulation only; never writes")
    p.add_argument("--effective-date", help="Actual YYYY-MM-DD, must be explicitly authorized")
    p.add_argument("--owner-authorization-reference")
    p.add_argument("--legal-review-reference")
    p.add_argument("--ga4-stream-match-evidence")
    args = p.parse_args()
    if args.dry_run:
        if any((args.effective_date, args.owner_authorization_reference,
                args.legal_review_reference, args.ga4_stream_match_evidence)):
            p.error("Dry-run cannot accept release evidence or a real effective date")
        files, manifest = package("2098-01-02")
        assert len(files) == 12 and manifest["checkout_enabled"] is False
        print("PASS: 12 final-format pages assembled IN MEMORY with all legal text identical")
        print("PASS: canonical public Terms, 10 Company mirrors, GA4 consent references, exact section hashes")
        print("NO FILES WRITTEN. No effective date, authorization, merge, payment, or deployment.")
        return
    if not args.effective_date:
        p.error("Default is no publication. Use --dry-run, or provide a fully authorized staging request.")
    authorization = nonempty_evidence(args.owner_authorization_reference, "owner publication authorization")
    legal = nonempty_evidence(args.legal_review_reference, "final legal review reference")
    stream = nonempty_evidence(args.ga4_stream_match_evidence, "GA4 web stream verification evidence")
    files, manifest = package(args.effective_date)
    output = ROOT / STAGING_NAME
    if output.exists():
        raise RuntimeError("Staging directory already exists; refusing overwrite")
    manifest.update({
        "owner_publication_authorization_reference": authorization,
        "legal_review_reference": legal,
        "ga4_stream_verification_reference": stream,
    })
    # This creates local files only. Human-owned deployment remains separately gated.
    for relative, content in files.items():
        path = output / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    (output / "STAGING_MANIFEST.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (output / "DO_NOT_DEPLOY_AUTOMATICALLY.txt").write_text(
        "Legal publication staging only. Review and independently authorize deployment.\n"
        "Do NOT upload review/ or any payment, secret, account or billing files.\n"
        "No Stripe payment link, webhook, live checkout, membership or customer email is enabled.\n",
        encoding="utf-8"
    )
    print("STAGED (NOT PUBLISHED):", output)
    print("Files:", len(files), "Checkout: disabled")

if __name__ == "__main__":
    main()
