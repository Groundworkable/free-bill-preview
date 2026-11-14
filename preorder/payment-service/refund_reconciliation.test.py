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

    def test_charge_only_dispute_resolves_using_verified_charge_snapshot(self):
        provider_charge = dict(id="ch_proven", payment_intent="pi_testOne", amount=1059,
                               currency="usd", livemode=False)
        js = [dict(event_id="evt_dispute_charge", event_type="charge.dispute.created",
                   object_id="dp_testOne", payment_intent_id=None, charge_id="ch_proven",
                   amount_cents=1059, financial_status="needs_response")]
        ds = [dict(id="dp_testOne", amount=1059, status="needs_response",
                   payment_intent=None, charge="ch_proven", currency="usd", livemode=False)]
        result = reconcile_test_snapshots(ORDER, [], ds, js, complete=True,
                                          charge_snapshots=[provider_charge])
        self.assertEqual(result["provided_charge_snapshot_count"], 1)
        self.assertNotIn("unresolved_charge_only_event:evt_dispute_charge", result["concerns"])
        self.assertNotIn("provider_dispute_wrong_or_missing_payment_intent:dp_testOne", result["concerns"])
        self.assertIn("dispute_present_requires_manual_review", result["concerns"])
        self.assertFalse(result["real_refund_execution_verified"])

    def test_conflicting_charge_reference_does_not_silently_reconcile(self):
        provider_charge = dict(id="ch_proven", payment_intent="pi_another", amount=1059,
                               currency="usd", livemode=False)
        js = [dict(event_id="evt_conflict", event_type="refund.updated",
                   object_id="re_testOne", payment_intent_id="pi_testOne",
                   charge_id="ch_proven", amount_cents=500, financial_status="succeeded")]
        rs = [dict(refund(), charge="ch_proven")]
        result = reconcile_test_snapshots(ORDER, rs, [], js, complete=True,
                                          charge_snapshots=[provider_charge],
                                          expected_refund_id="re_testOne", expected_refund_amount=500)
        self.assertIn("charge_intent_conflict:evt_conflict", result["concerns"])
        self.assertIn("charge_intent_conflict:re_testOne", result["concerns"])
        self.assertFalse(result["snapshot_indicates_requested_refund_succeeded"])

    def test_bad_or_duplicate_charge_snapshots_rejected(self):
        provider_charge = dict(id="ch_proven", payment_intent="pi_testOne", amount=1059,
                               currency="usd", livemode=False)
        for items in ([provider_charge, provider_charge],
                      [{**provider_charge, "livemode": True}],
                      [{**provider_charge, "payment_intent": None}]):
            with self.assertRaises(ValueError):
                reconcile_test_snapshots(ORDER, [], [], [], complete=True,
                                          charge_snapshots=items)

    def test_no_automatic_activation(self):
        with self.assertRaises(ValueError):
            reconcile_test_snapshots({**ORDER, "status": "active_membership"}, [], [], [], complete=True)
        self.assertEqual(ORDER["status"], "paid_unfulfilled")


if __name__ == "__main__":
    unittest.main()
