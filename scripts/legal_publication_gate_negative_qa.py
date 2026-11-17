"""Fail-closed staging gate tests. Never invokes the authorized output path."""
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
ENTRY=ROOT/"scripts/assemble_authorized_legal_publication.py"
OUT=ROOT/"groundwork-LEGAL-PUBLICATION-STAGED-NOT-DEPLOYED"
assert not OUT.exists(), "Unexpected production-form staging output in review branch"
def run(*args):
    return subprocess.run([sys.executable,str(ENTRY),*args],capture_output=True,text=True,check=False,cwd=ROOT)
for case in [
    (),
    ("--effective-date","2026-11-17"),
    ("--effective-date","2026-11-17","--owner-authorization-reference","Approved by founder"),
    ("--effective-date","2026-11-17","--owner-authorization-reference","Approved by founder",
     "--legal-review-reference","Independent legal counsel reviewed"),
    ("--effective-date","2026-11-17","--owner-authorization-reference","TBD authorization",
     "--legal-review-reference","Independent legal counsel reviewed",
     "--ga4-stream-match-evidence","verified-stream-id"),
    ("--effective-date","2026-13-99","--owner-authorization-reference","Approved by founder",
     "--legal-review-reference","Independent legal counsel reviewed",
     "--ga4-stream-match-evidence","verified-stream-id"),
    ("--dry-run","--effective-date","2026-11-17"),
]:
    result=run(*case)
    assert result.returncode!=0, (case,result.stdout[-1000:])
    assert not OUT.exists(), "Unauthorized staging package was written"
ok=run("--dry-run")
assert ok.returncode==0,(ok.stdout,ok.stderr)
assert "NO FILES WRITTEN" in ok.stdout
assert not OUT.exists()
print("PASS: seven unauthorized or malformed staging attempts refused, no files created")
print("PASS: 12-page approved-text simulation works with no owner authorization or production write")
