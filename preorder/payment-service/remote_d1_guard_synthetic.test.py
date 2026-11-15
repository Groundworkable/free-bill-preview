"""Offline CI rehearsal for founder-approved synthetic-only remote D1 guard audit.

Run only in ephemeral SQLite memory; NEVER connects to Cloudflare, Stripe or Resend.
Does not authorize adding any fixture to a live customer database.
"""
from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parent
def sql(name):
    return (root / name).read_text(encoding="utf8")

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript(sql("schema.sql"))
db.executescript(sql("remote_d1_notification_ledger_additive_migration_2026-11-15.sql"))

prefix = "remote_d1_guard_"
suffix = "_2026-11-15.sql"
name = lambda part: prefix + part + suffix
key = "gwn1_" + "e" * 64
session = "cs_test_D1ONLY_GUARD_20261115"

def preflight():
    return dict(db.execute(sql(name("01_readonly_preflight"))).fetchall())

assert preflight() == {
    "prepurchase_orders": 0,
    "prepurchase_notification_outbox": 0,
    "prepurchase_notification_state_journal": 0,
    "stripe_processed_events": 0,
    "prepurchase_payment_changes": 0,
}, preflight()

fixture = sql("remote_d1_guard_fixture_insert_2026-11-15.sql")
assert "INSERT INTO stripe_processed_events" not in fixture
assert "INSERT INTO prepurchase_payment_changes" not in fixture
assert "INSERT INTO prepurchase_orders" in fixture
assert "INSERT INTO prepurchase_notification_outbox" in fixture
assert "D1ONLY" in fixture and "FAKE_NO_PAYMENT" in fixture
assert "re_" not in fixture
db.executescript(fixture)
assert preflight() == {
    "prepurchase_orders": 1,
    "prepurchase_notification_outbox": 1,
    "prepurchase_notification_state_journal": 1,
    "stripe_processed_events": 0,
    "prepurchase_payment_changes": 0,
}, preflight()
# Idempotent fixture cannot create duplicates or extra audit entries on re-run.
db.executescript(fixture)
assert preflight()["prepurchase_notification_state_journal"] == 1

def reject(part, expected_phrase):
    try:
        db.executescript(sql(name(part)))
    except sqlite3.IntegrityError as exc:
        assert expected_phrase in str(exc), (part, str(exc))
    else:
        raise AssertionError("Failed to reject prohibited action: " + part)

reject("02_reject_invalid_transition", "unsafe or repeated notification state transition")
assert db.execute("SELECT state FROM prepurchase_notification_outbox WHERE notification_key=?", (key,)).fetchone() == ("review_pending",)

db.executescript(sql(name("03_manual_review_transition")))
assert db.execute("SELECT state FROM prepurchase_notification_outbox WHERE notification_key=?", (key,)).fetchone() == ("manual_review",)
reject("04_reject_identity_change", "immutable notification identity")
reject("05_reject_delete", "notification outbox is append-only for identities")

post = db.execute(sql(name("06_readonly_postcheck"))).fetchall()
assert len(post) == 4, post
assert ("notification", key, "manual_review", "D1_ONLY_NO_DELIVERY_20261115") in post
assert ("order", session, "paid_unfulfilled", "pi_FAKE_D1ONLY_GUARD_20261115") in post
assert ("journal", key, "review_pending", "FIRST") in post
assert ("journal", key, "manual_review", "review_pending") in post
# No actual provider event, email, entitlement or refund was generated.
assert db.execute("SELECT COUNT(*) FROM stripe_processed_events").fetchone()[0] == 0
assert db.execute("SELECT COUNT(*) FROM prepurchase_payment_changes").fetchone()[0] == 0
assert db.execute("SELECT COUNT(*) FROM prepurchase_notification_outbox WHERE state IN ('attempt_started','provider_accepted','delivered')").fetchone()[0] == 0

print("PASS: synthetic D1 guard fixture, invalid transitions, append-only protections, journal, and no provider events")
