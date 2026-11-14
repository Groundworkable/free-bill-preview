"""Offline synthetic rehearsal only: no Stripe calls, Cloudflare writes, or payment changes."""
import unittest
from refund_reconciliation import reconcile_test_snapshots

ORDER = dict(status="paid_unfulfilled", payment_intent_id="pi_testOne", total_cents=1059, currency="usd")


def refund(id="re_testOne", amount=500, status="succeeded", payment_intent="pi_testOne"):
    return dict(id=id, amount=amount, status=status, payment_intent=payment_intent, currency="usd", livemode=False)


def event(id="evt_testOne", status="succeeded", kind="refund.updated", object_id="re_testOne",
          amount=500, payment_intent="pi_testOne"):
    return dict(event_id=id, event_type=kind, object_id=object_id,
                financial_status=status, amount_cents=amount, payment_intent_id=payment_intent)


def dispute(id="dp_testOne", status="needs_response"):
    return dict(id=id, amount=1059, status=status, payment_intent="pi_testOne", currency="usd", livemode=False)


class RefundReconciliationTests(unittest.TestCase):
    def test_one_refund_multiple_events_out_of_order_counts_once(self):
        result = reconcile_test_snapshots(ORDER, [refund()], [], [event("evt_done"), event("evt_pending", "pending", "refund.created")],
                                          complete=True, expected_refund_id="re_testOne", expected_refund_amount=500)
        self.assertEqual(result["succeeded_refunds_cents"], 500)
        self.assertTrue(result["snapshot_indicates_requested_refund_succeeded"])
        self.assertFalse(result["real_refund_execution_verified"])

    def test_failed_is_not_succeeded_and_pending_not_spendable(self):
        rs = [refund("re_failed", 250, "failed"), refund("re_pending", 400, "pending")]
        js = [event("evt_failed", "failed", "refund.failed", "re_failed", 250),
              event("evt_pending", "pending", "refund.created", "re_pending", 400)]
        result = reconcile_test_snapshots(ORDER, rs, [], js, complete=True,
                                          expected_refund_id="re_pending", expected_refund_amount=400)
        self.assertEqual(result["succeeded_refunds_cents"], 0)
        self.assertEqual(result["pending_refunds_cents"], 400)
        self.assertEqual(result["failed_or_canceled_refunds_cents"], 250)
        self.assertFalse(result["snapshot_indicates_requested_refund_succeeded"])

    def test_dispute_blocks_refund_verification(self):
        result = reconcile_test_snapshots(ORDER, [refund()], [dispute()],
                                          [event(), event("evt_dispute", "needs_response", "charge.dispute.created", "dp_testOne", 1059)],
                                          complete=True, expected_refund_id="re_testOne", expected_refund_amount=500)
        self.assertIn("dispute_present_requires_manual_review", result["concerns"])
        self.assertFalse(result["snapshot_indicates_requested_refund_succeeded"])

    def test_charge_only_event_needs_linking(self):
        result = reconcile_test_snapshots(ORDER, [refund()], [], [event(payment_intent=None)],
                                          complete=True, expected_refund_id="re_testOne", expected_refund_amount=500)
        self.assertTrue(any(x.startswith("unresolved_charge_only_event:") for x in result["concerns"]))

    def test_missing_provider_row_and_missing_journal_are_flagged(self):
        result = reconcile_test_snapshots(ORDER, [refund("re_provider")], [], [event(object_id="re_old")], complete=True)
        self.assertTrue(any("journal_refund_not_in_provider_snapshot" in x for x in result["concerns"]))
        self.assertTrue(any("provider_refund_missing_from_journal" in x for x in result["concerns"]))

    def test_unverified_provider_snapshot_never_marks_success(self):
        result = reconcile_test_snapshots(ORDER, [refund()], [], [event()], complete=False,
                                          expected_refund_id="re_testOne", expected_refund_amount=500)
        self.assertFalse(result["snapshot_indicates_requested_refund_succeeded"])
        self.assertIn("provider_snapshot_completeness_unverified", result["concerns"])

    def test_overrefund_and_wrong_payment_intent_are_flagged(self):
        result = reconcile_test_snapshots(ORDER, [refund(amount=1060, payment_intent="pi_other")], [], [event(amount=1060)], complete=True)
        self.assertTrue(any("exceeds_purchase" in x for x in result["concerns"]))
        self.assertTrue(any("wrong_or_missing_payment_intent" in x for x in result["concerns"]))

    def test_duplicate_provider_refunds_rejected(self):
        with self.assertRaises(ValueError):
            reconcile_test_snapshots(ORDER, [refund(), refund()], [], [], complete=True)

    def test_duplicate_journal_events_rejected(self):
        with self.assertRaises(ValueError):
            reconcile_test_snapshots(ORDER, [refund()], [], [event(), event()], complete=True)

    def test_no_automatic_activation(self):
        with self.assertRaises(ValueError):
            reconcile_test_snapshots({**ORDER, "status": "active_membership"}, [], [], [], complete=True)
        self.assertEqual(ORDER["status"], "paid_unfulfilled")


if __name__ == "__main__":
    unittest.main()
