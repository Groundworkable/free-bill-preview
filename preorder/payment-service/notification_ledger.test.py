"""Test-only SQLite verification of draft notification outbox and audit ledger.

This is not a deployed migration or sender, and does not contact payment/email services.
"""
import sqlite3
from pathlib import Path

folder = Path(__file__).resolve().parent
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript((folder / "schema.sql").read_text(encoding="utf-8"))
db.executescript((folder / "notification_ledger.draft.sql").read_text(encoding="utf-8"))
db.execute(
    """INSERT INTO prepurchase_orders
    (checkout_session_id, payment_intent_id, stripe_customer_id, payment_link_id,
     stripe_price_id, term, terms_version, subtotal_cents, tax_cents, total_cents,
     currency, status) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
    ("cs_test_ledger1", "pi_ledger1", "plink_test_month", "price_test_month",
     "monthly", "prepurchase-v2026-11-13", 999, 0, 999, "usd", "paid_unfulfilled")
)
KEY = "gwn1_" + "a" * 64
KEY2 = "gwn1_" + "b" * 64
ALIAS = "groundwork-prepurchase-confirmation-review"
EMAIL_HMAC = "f" * 64


def reject(sql, params=()):
    try:
        with db:
            db.execute(sql, params)
    except sqlite3.IntegrityError:
        return
    raise AssertionError("Unsafe change unexpectedly accepted: " + sql)


def insert_notice(key=KEY, kind="purchase_confirmation", ref="purchase"):
    with db:
        db.execute(
            """INSERT INTO prepurchase_notification_outbox
            (notification_key,checkout_session_id,notice_type,notice_ref,
             recipient_hmac,template_alias)
             VALUES (?,?,?,?,?,?)""",
            (key, "cs_test_ledger1", kind, ref, EMAIL_HMAC, ALIAS)
        )


insert_notice()
row = db.execute(
    "SELECT state,attempt_token,provider_message_id FROM prepurchase_notification_outbox WHERE notification_key=?",
    (KEY,)
).fetchone()
assert row == ("review_pending", None, None)
assert db.execute(
    "SELECT old_state,new_state FROM prepurchase_notification_state_journal"
).fetchall() == [(None, "review_pending")]

# Duplicate logical notification denied by stable primary key and by
# (checkout_session_id, type, reference), even if a buggy client invents a new key.
reject("""INSERT INTO prepurchase_notification_outbox
    (notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias)
    VALUES (?,?,?,?,?,?)""",
       (KEY2,"cs_test_ledger1","purchase_confirmation","purchase",EMAIL_HMAC,ALIAS))
reject("""INSERT INTO prepurchase_notification_outbox
    (notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias)
    VALUES (?,?,?,?,?,?)""",
       (KEY,"cs_test_ledger1","delivery_update","date1",EMAIL_HMAC,
        "groundwork-prepurchase-delivery-update-review"))

# SQLite rowid tables can otherwise allow NULL in TEXT PRIMARY KEY columns.
reject("""INSERT INTO prepurchase_notification_outbox
    (notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias)
    VALUES (?,?,?,?,?,?)""",
    (None,"cs_test_ledger1","delivery_update","null-key",EMAIL_HMAC,
     "groundwork-prepurchase-delivery-update-review"))

# Direct insertion in sent/claimed states and fake recipient hash are prohibited.
reject("""INSERT INTO prepurchase_notification_outbox
    (notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,
    template_alias,state,attempt_token,attempt_started_at)
    VALUES (?,?,?,?,?,?,?,?,?)""",
    (KEY2,"cs_test_ledger1","delivery_update","date1",EMAIL_HMAC,
     "groundwork-prepurchase-delivery-update-review","attempt_started","unsafe","now"))
reject("""INSERT INTO prepurchase_notification_outbox
    (notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias)
    VALUES (?,?,?,?,?,?)""",
    (KEY2,"cs_test_ledger1","delivery_update","date1","plain@email.com",
     "groundwork-prepurchase-delivery-update-review"))
reject("""INSERT INTO prepurchase_notification_outbox
    (notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias)
    VALUES (?,?,?,?,?,?)""",
    (KEY2,"cs_test_missing","delivery_update","date1",EMAIL_HMAC,
     "groundwork-prepurchase-delivery-update-review"))

# The sole test record moves through a reviewed one-attempt path.
reject("UPDATE prepurchase_notification_outbox SET state='attempt_started' WHERE notification_key=?", (KEY,))
reject("UPDATE prepurchase_notification_outbox SET recipient_hmac=? WHERE notification_key=?", ("0"*64,KEY))
with db:
    db.execute("UPDATE prepurchase_notification_outbox SET state='review_verified',review_completed_at='review-a' WHERE notification_key=?", (KEY,))
reject("UPDATE prepurchase_notification_outbox SET state='attempt_started' WHERE notification_key=?", (KEY,))
with db:
    db.execute("UPDATE prepurchase_notification_outbox SET state='attempt_started',attempt_token='token-one',attempt_started_at='start-a' WHERE notification_key=?", (KEY,))
reject("UPDATE prepurchase_notification_outbox SET state='review_verified' WHERE notification_key=?", (KEY,))
reject("UPDATE prepurchase_notification_outbox SET state='attempt_started',attempt_token='token-two' WHERE notification_key=?", (KEY,))
reject("UPDATE prepurchase_notification_outbox SET state='delivered',delivered_at='fake' WHERE notification_key=?", (KEY,))
reject("UPDATE prepurchase_notification_outbox SET state='provider_accepted',provider_message_id='msg-one' WHERE notification_key=?", (KEY,))
with db:
    db.execute("UPDATE prepurchase_notification_outbox SET state='provider_accepted',provider_message_id='msg-one',provider_accepted_at='accepted-a' WHERE notification_key=?", (KEY,))
with db:
    db.execute("UPDATE prepurchase_notification_outbox SET state='delivered',delivered_at='delivery-a' WHERE notification_key=?", (KEY,))
reject("UPDATE prepurchase_notification_outbox SET state='attempt_started' WHERE notification_key=?", (KEY,))
reject("UPDATE prepurchase_notification_outbox SET provider_message_id='msg-two',state='manual_review' WHERE notification_key=?", (KEY,))
reject("DELETE FROM prepurchase_notification_outbox WHERE notification_key=?", (KEY,))
reject("UPDATE prepurchase_notification_state_journal SET new_state='fake'")
reject("DELETE FROM prepurchase_notification_state_journal")

states = [r[0] for r in db.execute(
    "SELECT new_state FROM prepurchase_notification_state_journal ORDER BY id"
)]
assert states == ["review_pending","review_verified","attempt_started","provider_accepted","delivered"], states
assert db.execute("SELECT COUNT(*) FROM prepurchase_notification_outbox").fetchone()[0] == 1

# An uncertain provider outcome is terminal/manual; never automatically resubmit.
insert_notice(KEY2, "delivery_update", "2026-12-18")
with db:
    db.execute("UPDATE prepurchase_notification_outbox SET state='manual_review' WHERE notification_key=?", (KEY2,))
reject("UPDATE prepurchase_notification_outbox SET state='review_verified' WHERE notification_key=?", (KEY2,))
reject("UPDATE prepurchase_notification_outbox SET state='attempt_started',attempt_token='retry' WHERE notification_key=?", (KEY2,))
assert db.execute(
    "SELECT new_state FROM prepurchase_notification_state_journal WHERE notification_key=? ORDER BY id",
    (KEY2,)
).fetchall() == [("review_pending",),("manual_review",)]

# Test transaction rollback: attempted invalid inserts cannot leave audit traces.
before = db.execute("SELECT COUNT(*) FROM prepurchase_notification_state_journal").fetchone()[0]
reject("""INSERT INTO prepurchase_notification_outbox
    (notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias)
    VALUES (?,?,?,?,?,?)""",
    ("gwn1_bad","cs_test_ledger1","delivery_update","invalid",EMAIL_HMAC,
     "groundwork-prepurchase-delivery-update-review"))
assert db.execute("SELECT COUNT(*) FROM prepurchase_notification_state_journal").fetchone()[0] == before

# Verify only staging; schema.sql remains the standalone deployed isolated D1 source.
assert "prepurchase_notification_outbox" not in (folder / "schema.sql").read_text(encoding="utf-8")
print("PASS: draft-only notice ledger uniqueness, immutable evidence, atomic journal, one attempt and manual hold")
