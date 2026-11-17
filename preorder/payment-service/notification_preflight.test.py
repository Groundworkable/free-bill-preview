"""Synthetic-only tests for notification preflight. No sending or transactions."""
import unittest
from notification_preflight import inspect_notification_preflight

ORDER = {
    "checkout_session_id": "cs_test_Example01", "payment_intent_id": "pi_Example01",
    "status": "paid_unfulfilled", "currency": "usd"
}
CONTACT = {
    "isolated_test_only": True, "provider_evidence_asserted_verified": True,
    "stored_purchase_matches_provider": True, "requester_email_matches_provider": True,
    "evidence_consistent_for_manual_review": True,
    "requires_identity_verification_by_operator": True, "concerns": [],
}
REFUND = {
    "id": "re_Example01", "livemode": False, "currency": "usd",
    "amount": 999, "payment_intent": "pi_Example01", "status": "pending",
    "provider_initiation_verified": True,
}

class NotificationPreflightTests(unittest.TestCase):
    def preflight(self, kind="purchase_confirmation", **overrides):
        args = {
            "kind": kind, "order": ORDER, "contact_check": CONTACT,
            "provider_event_verified": True,
        }
        args.update(overrides)
        return inspect_notification_preflight(**args)

    def test_purchase_consistent_is_manual_review_only(self):
        result = self.preflight()
        self.assertTrue(result["manual_review_candidate"])
        self.assertTrue(result["review_key"].startswith("gwn1_"))
        for flag in ("authorization_to_send", "authorization_to_refund",
                     "authorization_to_activate_membership", "identity_proven",
                     "delivery_verified"):
            self.assertFalse(result[flag])

    def test_repeat_purchase_is_detected(self):
        key = self.preflight()["review_key"]
        second = self.preflight(previously_sent_keys={key})
        self.assertFalse(second["manual_review_candidate"])
        self.assertIn("logical_notice_already_sent", second["concerns"])

    def test_delivery_updates_deduplicate_by_revision_not_delivery_time(self):
        first = self.preflight("delivery_update",notice_revision="2026-12-18")
        self.assertTrue(first["manual_review_candidate"])
        self.assertEqual(first["review_key"],
                         self.preflight("delivery_update",notice_revision="2026-12-18")["review_key"])
        self.assertNotEqual(first["review_key"],
                            self.preflight("delivery_update",notice_revision="2027-01-01")["review_key"])
        self.assertIn("logical_notice_already_sent",
                      self.preflight("delivery_update",notice_revision="2026-12-18",
                                     previously_sent_keys=[first["review_key"]])["concerns"])

    def test_reject_missing_revision(self):
        result = self.preflight("delivery_update")
        self.assertFalse(result["manual_review_candidate"])
        self.assertIsNone(result["review_key"])
        self.assertIn("missing_or_invalid_notice_revision",result["concerns"])

    def test_refund_notice_requires_verified_provider_refund(self):
        self.assertTrue(self.preflight("refund_initiated",refund=REFUND)["manual_review_candidate"])
        for change in ({"status":"failed"},{"provider_initiation_verified":False},
                       {"livemode":True},{"payment_intent":"pi_Other"},{"amount":0}):
            result=self.preflight("refund_initiated",refund={**REFUND,**change})
            self.assertFalse(result["manual_review_candidate"])
            self.assertIn("refund_initiation_not_verified",result["concerns"])

    def test_refund_notice_key_is_specific_to_refund_and_order(self):
        a=self.preflight("refund_initiated",refund=REFUND)["review_key"]
        b=self.preflight("refund_initiated",refund={**REFUND,"id":"re_Second"})["review_key"]
        self.assertNotEqual(a,b)
        self.assertNotEqual(a,self.preflight()["review_key"])
        self.assertIn("logical_notice_already_sent",
                      self.preflight("refund_initiated",refund=REFUND,
                                     previously_sent_keys=[a])["concerns"])

    def test_provider_assertion_and_contact_consistency_are_required(self):
        for change in ({"provider_event_verified":False},
                       {"contact_check":{**CONTACT,"requester_email_matches_provider":False}},
                       {"contact_check":{**CONTACT,"concerns":["claimant_email_mismatch"]}}):
            result=self.preflight(**change)
            self.assertFalse(result["manual_review_candidate"])
            self.assertFalse(result["authorization_to_send"])

    def test_never_includes_personal_data(self):
        result=self.preflight(order={**ORDER,"email":"sensitive@example.com"},
                              contact_check={**CONTACT,"email":"sensitive@example.com"})
        self.assertNotIn("sensitive@example.com",repr(result))
        self.assertNotIn("pi_Example01",repr(result))
        self.assertNotIn("cs_test_Example01",repr(result))

    def test_live_checkout_rejected(self):
        result=self.preflight(order={**ORDER,"checkout_session_id":"cs_live_NotAllowed"})
        self.assertFalse(result["manual_review_candidate"])
        self.assertIn("unverified_isolated_test_order",result["concerns"])

    def test_invalid_type_rejected(self):
        with self.assertRaises(ValueError): self.preflight("marketing")
        with self.assertRaises(ValueError): self.preflight(provider_event_verified="true")
        with self.assertRaises(ValueError): self.preflight(previously_sent_keys="gwn1_abc")

if __name__=="__main__":
    unittest.main()
