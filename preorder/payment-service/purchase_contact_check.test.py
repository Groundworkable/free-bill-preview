"""Purely synthetic, offline verification of Stripe-to-D1 contact support preflight."""
import unittest
from purchase_contact_check import inspect_test_purchase_contact

ORDER = dict(
    status="paid_unfulfilled", currency="usd", checkout_session_id="cs_test_MonthOne",
    payment_intent_id="pi_MonthOne", payment_link_id="plink_test_Month",
    stripe_customer_id="cus_TestOne", total_cents=1059
)
SESSION = dict(
    object="checkout.session", id="cs_test_MonthOne", livemode=False, mode="payment",
    payment_status="paid", payment_intent="pi_MonthOne", payment_link="plink_test_Month",
    customer="cus_TestOne", currency="usd", amount_total=1059,
    consent={"terms_of_service":"accepted"},
    customer_details={"email":" Test.Buyer@Example.com "}, customer_email=None
)

class PurchaseContactPreflightTests(unittest.TestCase):
    def check(self, order=ORDER, session=SESSION, email="test.buyer@example.com", verified=True):
        return inspect_test_purchase_contact(order,session,requester_email=email,provider_verified=verified)

    def test_consistent_snapshot_allows_only_manual_review(self):
        result=self.check()
        self.assertTrue(result["stored_purchase_matches_provider"])
        self.assertTrue(result["requester_email_matches_provider"])
        self.assertTrue(result["evidence_consistent_for_manual_review"])
        for name in ("authorizes_refund","authorizes_customer_message","authorizes_membership"):
            self.assertIs(result[name],False)
        self.assertTrue(result["requires_identity_verification_by_operator"])
        self.assertNotIn("test.buyer@example.com",repr(result))

    def test_requires_independent_stripe_retrieval(self):
        result=self.check(verified=False)
        self.assertIn("stripe_snapshot_not_independently_verified",result["concerns"])
        self.assertFalse(result["evidence_consistent_for_manual_review"])

    def test_claimant_mismatch_is_not_ownership(self):
        result=self.check(email="stranger@example.com")
        self.assertIn("claimant_email_mismatch",result["concerns"])
        self.assertFalse(result["requester_email_matches_provider"])
        self.assertFalse(result["evidence_consistent_for_manual_review"])

    def test_wrong_payment_intent_and_amount_block(self):
        for change,code in (
            ({"payment_intent":"pi_NotTheOrder"},"payment_intent_id_mismatch"),
            ({"amount_total":1060},"total_mismatch"),
            ({"payment_link":"plink_other"},"payment_link_id_mismatch"),
            ({"consent":{}},"terms_acceptance_missing"),
            ({"livemode":True},"not_verified_paid_test_checkout"),
            ({"payment_status":"unpaid"},"not_verified_paid_test_checkout")
        ):
            result=self.check(session={**SESSION,**change})
            self.assertIn(code,result["concerns"])
            self.assertFalse(result["evidence_consistent_for_manual_review"])

    def test_missing_email_does_not_claim_contact(self):
        result=self.check(session={**SESSION,"customer_details":None,"customer_email":None})
        self.assertIn("stripe_contact_email_missing",result["concerns"])
        self.assertFalse(result["requester_email_matches_provider"])

    def test_disagreeing_provider_emails_rejected(self):
        result=self.check(session={**SESSION,"customer_email":"different@example.com"})
        self.assertIn("stripe_contact_email_conflict",result["concerns"])
        self.assertFalse(result["requester_email_matches_provider"])

    def test_bare_provider_email_supported_if_consistent(self):
        result=self.check(session={**SESSION,"customer_details":None,
                                    "customer_email":"TEST.BUYER@example.com"})
        self.assertTrue(result["evidence_consistent_for_manual_review"])

    def test_null_or_invalid_snapshots_fail(self):
        with self.assertRaises(ValueError): self.check(session=None)
        with self.assertRaises(ValueError): self.check(order=None)
        with self.assertRaises(ValueError): self.check(verified="true")

    def test_no_pi_or_customer_identity_link_alone_is_a_verification(self):
        result=self.check(order={**ORDER,"stripe_customer_id":"cus_Other"})
        self.assertIn("stripe_customer_id_mismatch",result["concerns"])
        self.assertFalse(result["evidence_consistent_for_manual_review"])
        self.assertTrue(result["requires_identity_verification_by_operator"])

if __name__=="__main__":
    unittest.main()
