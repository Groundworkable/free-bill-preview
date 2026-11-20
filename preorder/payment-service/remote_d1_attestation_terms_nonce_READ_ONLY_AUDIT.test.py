"""TEST-ONLY: executes the review audit against disposable in-memory SQLite.

No Cloudflare, Stripe, OTP, email, secrets, or provider requests.
"""
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).parent
AUDIT = (ROOT / "remote_d1_attestation_terms_nonce_READ_ONLY_AUDIT.sql").read_text()
BASE = (ROOT / "schema.sql").read_text()
NONCE = (ROOT / "remote_d1_attestation_request_nonce_DRAFT_DO_NOT_APPLY.sql").read_text()
CHECKOUT = "cs_test_a0wyfpMSTBjf3jPB2IktXBafoR3mMkHO7cjwNnEGG0WurnPxo8BPBRuirZ"


def audit(db):
    # Read-only statement enforcement is at the SQLite authorizer, not merely
    # a best-effort SQL string search. A SELECT with side effects is blocked.
    allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE}
    def guard(action, *_):
        return sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY

    db.set_authorizer(guard)
    try:
        # sqlite3.execute() refuses multiple statements in one execution.
        # This audit consists of exactly 3 SELECT/CTE statements, split by the
        # semicolon separators after stripping comment-only lines.
        lines = [
            line for line in AUDIT.splitlines()
            if line.strip() and not line.lstrip().startswith("--")
        ]
        statements = [s.strip() for s in "\n".join(lines).split(";") if s.strip()]
        assert len(statements) == 3, "Audit changed: expected exactly three SELECTs"
        return [db.execute(q).fetchall() for q in statements]
    finally:
        db.set_authorizer(None)


class ReadOnlyAuditTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript(BASE)

    def tearDown(self):
        self.db.close()

    def test_absent_ledger_and_missing_order_fail_closed(self):
        objects, columns, terms = audit(self.db)
        self.assertEqual([r[3] for r in objects], ["MISSING"] * 4)
        self.assertEqual([r[2] for r in columns], ["MISSING"] * 3)
        self.assertEqual(terms, [("original_test_terms", 0, "NOT_VERIFIED")])

    def test_nonce_schema_and_unique_test_order(self):
        self.db.executescript(NONCE)
        self.db.execute(
            "INSERT INTO prepurchase_orders "
            "(checkout_session_id,payment_intent_id,stripe_customer_id,"
            "payment_link_id,stripe_price_id,term,terms_version,subtotal_cents,"
            "tax_cents,total_cents,currency,status) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (CHECKOUT, "pi_testsynthetic", None,
             "plink_1UbK33JK9stEim4w7BvY2CnM",
             "price_1UbK2YJK9stEim4wCsZ0tyao", "monthly",
             "prepurchase-v2026-11-17", 999, 90, 1089, "usd", "paid_unfulfilled"),
        )
        objects, columns, terms = audit(self.db)
        self.assertTrue(all(r[3] == "PRESENT" for r in objects))
        self.assertTrue(all(r[2] == "PRESENT" for r in columns))
        self.assertEqual(terms, [("original_test_terms", 1, "prepurchase-v2026-11-17")])

    def test_payment_mismatch_cannot_assert_terms_version(self):
        self.db.execute(
            "INSERT INTO prepurchase_orders "
            "(checkout_session_id,payment_intent_id,stripe_customer_id,"
            "payment_link_id,stripe_price_id,term,terms_version,subtotal_cents,"
            "tax_cents,total_cents,currency,status) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (CHECKOUT, "pi_testsynthetic", None,
             "plink_wrong", "price_1UbK2YJK9stEim4wCsZ0tyao",
             "monthly", "prepurchase-v2026-11-17", 999, 90, 1089,
             "usd", "paid_unfulfilled"),
        )
        self.assertEqual(audit(self.db)[2],
                         [("original_test_terms", 0, "NOT_VERIFIED")])


if __name__ == "__main__":
    unittest.main()
