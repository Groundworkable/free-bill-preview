"""Run the isolated D1-compatible SQLite schema through real constraint/rollback checks."""
import sqlite3
from pathlib import Path

path = Path(__file__).with_name("schema.sql")
connection = sqlite3.connect(":memory:")
connection.executescript(path.read_text(encoding="utf-8"))
columns = [r[1] for r in connection.execute("PRAGMA table_info(prepurchase_orders)")]
assert "status" in columns
assert "entitlement_status" not in columns
assert "user_id" not in columns

def add(session, intent, amount, tax, total, status="paid_unfulfilled"):
    connection.execute(
        """INSERT INTO prepurchase_orders(
           checkout_session_id,payment_intent_id,stripe_customer_id,payment_link_id,
           stripe_price_id,term,terms_version,subtotal_cents,tax_cents,total_cents,currency,status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (session,intent,None,"plink_test","price_test","monthly","prepurchase-v2026-11-13",amount,tax,total,"usd",status)
    )

with connection:
    connection.execute("INSERT INTO stripe_processed_events(event_id,event_type,checkout_session_id) VALUES(?,?,?)",
                       ("evt_one","checkout.session.completed","cs_test_one"))
    add("cs_test_one","pi_one",999,60,1059)
assert connection.execute("SELECT COUNT(*) FROM prepurchase_orders").fetchone()[0] == 1

for args in [
    ("cs_test_one","pi_other",999,0,999), # duplicate session
    ("cs_test_two","pi_one",999,0,999), # reused payment intent
    ("cs_test_bad","pi_bad",999,40,999), # bad tax/total
    ("cs_test_active","pi_active",999,0,999,"active_membership"), # access must not be granted
]:
    try:
        with connection:
            add(*args)
        raise AssertionError("Invalid or duplicate purchase was accepted")
    except sqlite3.IntegrityError:
        pass

# An atomic event/order batch must roll back when the order insert fails.
try:
    with connection:
        connection.execute("INSERT INTO stripe_processed_events(event_id,event_type,checkout_session_id) VALUES(?,?,?)",
                           ("evt_rollback","checkout.session.completed","cs_test_bad"))
        add("cs_test_bad","pi_bad",999,40,999)
    raise AssertionError("Expected constraint failure")
except sqlite3.IntegrityError:
    pass
assert connection.execute("SELECT COUNT(*) FROM stripe_processed_events WHERE event_id='evt_rollback'").fetchone()[0] == 0

assert connection.execute("SELECT status FROM prepurchase_orders").fetchone()[0] == "paid_unfulfilled"
print("PASS: isolated schema, tax totals, duplicate order/payment IDs, no auto-activation, atomic rollback")
