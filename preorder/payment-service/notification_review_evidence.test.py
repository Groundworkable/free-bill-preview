"""Offline SQL guard test; all changes in ephemeral in-memory SQLite."""
from pathlib import Path
import sqlite3
root=Path(__file__).resolve().parent
db=sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
for filename in ("schema.sql","remote_d1_notification_ledger_additive_migration_2026-11-15.sql",
                 "notification_review_evidence.draft.sql"):
    db.executescript((root/filename).read_text(encoding="utf8"))
session="cs_test_ReviewOnly"
key="gwn1_"+"c"*64
db.execute("""INSERT INTO prepurchase_orders
(checkout_session_id,payment_intent_id,payment_link_id,stripe_price_id,term,
terms_version,subtotal_cents,tax_cents,total_cents,currency,status)
VALUES (?,?,?,?,?,?,?,?,?,?,?)""",(session,"pi_ReviewOnly","plink_test_ReviewOnly","price_test_ReviewOnly",
"monthly","prepurchase-v2026-11-15",999,0,999,"usd","paid_unfulfilled"))
db.execute("""INSERT INTO prepurchase_notification_outbox
(notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias)
VALUES (?,?,?,?,?,?)""",(key,session,"purchase_confirmation","purchase","f"*64,
"groundwork-prepurchase-confirmation-review"))

def reject(command,params=(),expected=None):
    try: db.execute(command,params)
    except sqlite3.IntegrityError as exc:
        if expected: assert expected in str(exc),str(exc)
        return
    raise AssertionError("Unexpected success: "+command)
reject("UPDATE prepurchase_notification_outbox SET state='review_verified',review_completed_at=? WHERE notification_key=?",
       ("2026-11-15T12:00:00.000Z",key),"independent review evidence required")
proof=(key,session,"purchase_confirmation","purchase","f"*64,"a"*64,"b"*64,
       "2026-11-15T12:00:00.000Z","c"*64)
db.execute("""INSERT INTO prepurchase_notification_review_evidence
(notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,
reviewer_hmac,provider_proof_hmac,reviewed_at,authorization_seal)
VALUES (?,?,?,?,?,?,?,?,?)""",proof)
reject("DELETE FROM prepurchase_notification_review_evidence WHERE notification_key=?",
       (key,),"append-only")
reject("UPDATE prepurchase_notification_review_evidence SET reviewer_hmac=? WHERE notification_key=?",
       ("d"*64,key),"append-only")
reject("INSERT INTO prepurchase_notification_review_evidence "
       "(notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,"
       "reviewer_hmac,provider_proof_hmac,reviewed_at,authorization_seal) VALUES (?,?,?,?,?,?,?,?,?)",proof)
reject("UPDATE prepurchase_notification_outbox SET state='review_verified',review_completed_at=? WHERE notification_key=?",
       ("2026-11-15T12:01:00.000Z",key),"independent review evidence required")
db.execute("UPDATE prepurchase_notification_outbox SET state='review_verified',review_completed_at=? WHERE notification_key=?",
           ("2026-11-15T12:00:00.000Z",key))
assert db.execute("SELECT state FROM prepurchase_notification_outbox WHERE notification_key=?",(key,)).fetchone()==("review_verified",)
assert db.execute("SELECT old_state,new_state FROM prepurchase_notification_state_journal WHERE notification_key=? ORDER BY id",(key,)).fetchall()==[(None,"review_pending"),("review_pending","review_verified")]
print("PASS: remote-draft review evidence trigger requires immutable bound proof and audits approval")
