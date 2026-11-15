"""Offline-only migration gate: never touches remote Cloudflare D1 or providers."""
from pathlib import Path
import re
import sqlite3

root = Path(__file__).resolve().parent
draft = (root / "notification_review_evidence.draft.sql").read_text(encoding="utf8")
migration = (root / "remote_d1_review_evidence_additive_migration_2026-11-15.sql").read_text(encoding="utf8")
expected_source = "\n".join(line for line in draft.splitlines()
                            if not line.lstrip().startswith("--")).strip()
assert migration.strip() == expected_source, "Migration differs from approved review-evidence schema"
assert len(re.findall(r"^CREATE TABLE IF NOT EXISTS ", migration, re.M)) == 1
assert len(re.findall(r"^CREATE TRIGGER IF NOT EXISTS ", migration, re.M)) == 4
assert not re.search(r"^\s*(?:DROP|ALTER|INSERT|UPDATE|DELETE|REPLACE|ATTACH|VACUUM)\b",
                     migration,re.I | re.M)
assert "CREATE TABLE IF NOT EXISTS prepurchase_notification_review_evidence" in migration

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
for name in ("schema.sql","remote_d1_notification_ledger_additive_migration_2026-11-15.sql"):
    db.executescript((root / name).read_text(encoding="utf8"))
db.execute("""INSERT INTO prepurchase_orders
(checkout_session_id,payment_intent_id,payment_link_id,stripe_price_id,
term,terms_version,subtotal_cents,tax_cents,total_cents,currency,status)
VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
("cs_test_ReviewMigration","pi_ReviewMigration","plink_FAKE_ReviewMigration","price_FAKE_ReviewMigration",
 "monthly","prepurchase-v2026-11-15",999,0,999,"usd","paid_unfulfilled"))
db.execute("""INSERT INTO prepurchase_notification_outbox
(notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias)
VALUES (?,?,?,?,?,?)""",("gwn1_"+"b"*64,"cs_test_ReviewMigration",
"purchase_confirmation","purchase","f"*64,"groundwork-prepurchase-confirmation-review"))
tables = ("prepurchase_orders","prepurchase_payment_changes","stripe_processed_events",
          "prepurchase_notification_outbox","prepurchase_notification_state_journal")
snapshots={name:db.execute(f"SELECT * FROM {name}").fetchall() for name in tables}
db.executescript(migration)
db.executescript(migration)  # IF NOT EXISTS must be repeatable
for name,before in snapshots.items():
    assert db.execute(f"SELECT * FROM {name}").fetchall()==before, name
objects=set(db.execute("SELECT type,name FROM sqlite_master").fetchall())
required={("table","prepurchase_notification_review_evidence")}
required.update(("trigger",name) for name in (
    "notification_review_evidence_guard_insert",
    "notification_review_evidence_block_update",
    "notification_review_evidence_block_delete",
    "notification_outbox_requires_review_evidence"))
assert required <= objects, required - objects
try:
    db.execute("UPDATE prepurchase_notification_outbox SET state='review_verified',review_completed_at=? WHERE notification_key=?",
               ("2026-11-15T12:00:00.000Z","gwn1_"+"b"*64))
except sqlite3.IntegrityError as exc:
    assert "independent review evidence required" in str(exc)
else:
    raise AssertionError("Missing review evidence was accepted")
print("PASS: reviewed five-object migration is additive, repeatable, preserves previous rows, and fails closed")
