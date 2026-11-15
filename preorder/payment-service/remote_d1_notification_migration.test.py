"""Offline regression gate for the additive isolated D1 notification-ledger migration.

Uses SQLite IN MEMORY only. Never connects to Cloudflare, Stripe, or Resend.
Checks source parity, original purchase preservation, schema completeness,
repeatability, and append-only outbox/audit safeguards.
"""
from pathlib import Path
import re
import sqlite3

folder = Path(__file__).resolve().parent
original = (folder / "schema.sql").read_text(encoding="utf-8")
reviewed = (folder / "notification_ledger.draft.sql").read_text(encoding="utf-8")
migration = (folder / "remote_d1_notification_ledger_additive_migration_2026-11-15.sql").read_text(encoding="utf-8")
no_comments = "\n".join(
    line for line in reviewed.splitlines() if not line.lstrip().startswith("--")
).strip()
assert migration.strip() == no_comments, "Remote migration must match reviewed ledger SQL exactly"
assert not re.search(r"^\s*(?:DROP|ALTER|DELETE|UPDATE|REPLACE|ATTACH|PRAGMA)\b", migration, re.I | re.M)
assert len(re.findall(r"^CREATE (?:TABLE|INDEX|TRIGGER) IF NOT EXISTS ", migration, re.M)) == 10
assert not re.search(r"^CREATE\\s+(?:TABLE|INDEX|TRIGGER)\\s+IF NOT EXISTS\\s+(?:prepurchase_orders|prepurchase_payment_changes|stripe_processed_events)\\b",migration,re.I|re.M), "Must not recreate payment objects"

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript(original)
with db:
    db.execute(
        """INSERT INTO prepurchase_orders
        (checkout_session_id,payment_intent_id,payment_link_id,stripe_price_id,term,
        terms_version,subtotal_cents,tax_cents,total_cents,currency,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        ("cs_test_MigrationRecord", "pi_MigrationRecord", "plink_test_one",
         "price_test_one","monthly","prepurchase-v2026-11-13",999,0,999,"usd","paid_unfulfilled")
    )
    db.execute(
        "INSERT INTO stripe_processed_events(event_id,event_type,checkout_session_id) VALUES (?,?,?)",
        ("evt_MigrationRecord","checkout.session.completed","cs_test_MigrationRecord")
    )
snapshot = {
    name: db.execute(f"SELECT * FROM {name}").fetchall()
    for name in ("prepurchase_orders","stripe_processed_events","prepurchase_payment_changes")
}

db.executescript(migration)
db.executescript(migration)  # All CREATE statements have IF NOT EXISTS.

names = db.execute("SELECT type,name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").fetchall()
actual = set(names)
expected = {
    ("table","prepurchase_notification_outbox"),
    ("table","prepurchase_notification_state_journal"),
    ("index","idx_notice_review_state"),
    *[("trigger",x) for x in (
        "notification_outbox_create_only_pending",
        "notification_outbox_guard_transition",
        "notification_outbox_block_delete",
        "notification_outbox_audit_insert",
        "notification_outbox_audit_transition",
        "notification_state_journal_block_update",
        "notification_state_journal_block_delete",
    )],
}
assert expected <= actual, sorted(expected - actual)
for name, before in snapshot.items():
    assert db.execute(f"SELECT * FROM {name}").fetchall() == before, name

key = "gwn1_" + "b" * 64
with db:
    db.execute(
        """INSERT INTO prepurchase_notification_outbox
        (notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias)
        VALUES (?,?,?,?,?,?)""",
        (key,"cs_test_MigrationRecord","purchase_confirmation","purchase","f"*64,
         "groundwork-prepurchase-confirmation-review")
    )
assert db.execute(
    "SELECT old_state,new_state FROM prepurchase_notification_state_journal WHERE notification_key=?",
    (key,)
).fetchall() == [(None, "review_pending")]

def must_reject(sql,args=()):
    try:
        with db:
            db.execute(sql,args)
    except sqlite3.IntegrityError:
        return
    raise AssertionError("Unsafe modification accepted: "+sql)

must_reject("UPDATE prepurchase_notification_outbox SET state='delivered' WHERE notification_key=?",(key,))
must_reject("DELETE FROM prepurchase_notification_outbox WHERE notification_key=?",(key,))
must_reject("UPDATE prepurchase_notification_state_journal SET new_state='delivered'")
must_reject("DELETE FROM prepurchase_notification_state_journal")
must_reject("UPDATE prepurchase_orders SET total_cents=1 WHERE checkout_session_id=?",("cs_test_MigrationRecord",))
for name, before in snapshot.items():
    assert db.execute(f"SELECT * FROM {name}").fetchall() == before, name

print("PASS: additive notification migration matches reviewed SQL, keeps payment records intact, and enforces audit restrictions")
