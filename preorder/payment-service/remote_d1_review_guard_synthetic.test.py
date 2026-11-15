"""Offline rehearsal of remote D1 synthetic negative-only approval-evidence tests.

All SQL executes against ephemeral SQLite only, never remote Cloudflare D1.
The remote fixture, if separately authorized, remains permanently append-only
and deliberately UNAPPROVED. Never call a provider, send email or grant access.
"""
from pathlib import Path
import sqlite3

folder=Path(__file__).resolve().parent
def sql(step):
    return (folder/f"remote_d1_review_guard_{step}_2026-11-15.sql").read_text(encoding="utf8")
db=sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
for name in ("schema.sql","remote_d1_notification_ledger_additive_migration_2026-11-15.sql",
             "remote_d1_review_evidence_additive_migration_2026-11-15.sql"):
    db.executescript((folder/name).read_text(encoding="utf8"))
old=(folder/"remote_d1_guard_fixture_insert_2026-11-15.sql").read_text(encoding="utf8")
db.executescript(old)
# The original synthetic notification is already in manual_review on remote.
prior=(folder/"remote_d1_guard_03_manual_review_transition_2026-11-15.sql").read_text(encoding="utf8")
db.executescript(prior)
pre=dict(db.execute(sql("01_readonly_preflight")).fetchall())
assert len(pre)==6 and set(pre.values())=={"READY"},pre
db.executescript(sql("02_insert_pending_fixture"))
initial=dict(db.execute(sql("03_readonly_fixture_check")).fetchall())
assert len(initial)==4 and set(initial.values())=={"PASS"},initial

def expect_rejection(step, phrase):
    try: db.executescript(sql(step))
    except sqlite3.IntegrityError as exc:
        assert phrase in str(exc),(step,str(exc))
    else: raise AssertionError("Unsafe remote plan SQL unexpectedly succeeded: "+step)

expect_rejection("04_reject_approval_without_evidence","independent review evidence required")
expect_rejection("05_reject_mismatched_evidence","review evidence must bind to a pending notice")
db.executescript(sql("06_insert_synthetic_evidence"))
expect_rejection("07_reject_evidence_update","review evidence is append-only")
expect_rejection("08_reject_evidence_delete","review evidence is append-only")
expect_rejection("09_reject_approval_timestamp_mismatch","independent review evidence required")
post=dict(db.execute(sql("10_readonly_postcheck")).fetchall())
assert len(post)==6 and set(post.values())=={"PASS"},post
# The previous immutable test fixture stays in manual_review and unchanged.
assert db.execute("""SELECT state FROM prepurchase_notification_outbox
 WHERE notification_key=?""",("gwn1_"+"e"*64,)).fetchone()==("manual_review",)
# The synthetic review record never grants review_verified.
assert db.execute("""SELECT COUNT(*) FROM prepurchase_notification_outbox
 WHERE state='review_verified'""").fetchone()[0]==0
assert db.execute("SELECT COUNT(*) FROM stripe_processed_events").fetchone()[0]==0
print("PASS: read-only preflight, synthetic pending/evidence only, expected guard errors, unchanged journal and no approvals")
