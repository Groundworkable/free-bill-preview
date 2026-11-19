"""Draft-only isolated SQLite/D1 nonce ledger checks. No remote D1 access."""
import pathlib
import sqlite3
import tempfile
import threading
import time
import unittest

SCHEMA = pathlib.Path(__file__).with_name(
    "remote_d1_attestation_request_nonce_DRAFT_DO_NOT_APPLY.sql"
).read_text(encoding="utf-8")


class NonceLedgerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.tmp.name) / "isolated-test-only.sqlite"
        with self.connect() as conn:
            conn.executescript(SCHEMA)

    def tearDown(self):
        self.tmp.cleanup()

    def connect(self):
        db = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        db.execute("PRAGMA busy_timeout=5000")
        return db

    def claim(self, conn, nonce, timestamp=None):
        return conn.execute(
            "INSERT INTO prepurchase_attestation_request_nonces"
            "(nonce_hex,request_timestamp) VALUES (?,?)",
            (nonce, int(time.time()) if timestamp is None else timestamp),
        )

    def test_one_unique_nonce_and_append_only_constraints(self):
        nonce = "a" * 64
        with self.connect() as c:
            self.claim(c, nonce)
            with self.assertRaises(sqlite3.IntegrityError):
                self.claim(c, nonce)
            with self.assertRaises(sqlite3.IntegrityError):
                c.execute(
                    "UPDATE prepurchase_attestation_request_nonces "
                    "SET request_timestamp=? WHERE nonce_hex=?",
                    (int(time.time()), nonce),
                )
            with self.assertRaises(sqlite3.IntegrityError):
                c.execute(
                    "DELETE FROM prepurchase_attestation_request_nonces "
                    "WHERE nonce_hex=?", (nonce,),
                )
            self.assertEqual(
                c.execute(
                    "SELECT COUNT(*) FROM prepurchase_attestation_request_nonces"
                ).fetchone()[0],
                1,
            )

    def test_rejects_malformed_and_expired_nonce_claims(self):
        with self.connect() as c:
            for nonce, timestamp in (
                ("g" * 64, None),
                ("A" * 64, None),
                ("b" * 63, None),
                ("c" * 64, int(time.time()) - 120),
                ("d" * 64, int(time.time()) + 120),
            ):
                with self.subTest(nonce=nonce[:4], timestamp=timestamp):
                    with self.assertRaises(sqlite3.IntegrityError):
                        self.claim(c, nonce, timestamp)
            self.assertEqual(
                c.execute(
                    "SELECT COUNT(*) FROM prepurchase_attestation_request_nonces"
                ).fetchone()[0],
                0,
            )

    def test_concurrent_writers_cannot_both_claim_same_nonce(self):
        barrier = threading.Barrier(2)
        results = []
        lock = threading.Lock()

        def worker():
            with self.connect() as c:
                barrier.wait(timeout=5)
                try:
                    self.claim(c, "e" * 64)
                    outcome = "accepted"
                except sqlite3.IntegrityError:
                    outcome = "duplicate"
                with lock:
                    results.append(outcome)

        threads = [threading.Thread(target=worker) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=7)
            self.assertFalse(t.is_alive(), "concurrent insert deadlocked")
        self.assertCountEqual(results, ["accepted", "duplicate"])


if __name__ == "__main__":
    unittest.main()
