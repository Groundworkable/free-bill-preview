"""Offline provider-readiness contract checks; no network requests or credentials.

Protects the deployment boundary between the isolated production-shaped payment
receiver and the founder-only synthetic notification test harness. A PASS here
is NOT permission to enable Stripe/Resend or deploy a sender.
"""
from pathlib import Path
import json

root = Path(__file__).resolve().parent
worker = (root / "worker.mjs").read_text(encoding="utf-8")
sender = (root / "notification_sender.sandbox.mjs").read_text(encoding="utf-8")
providers = (root / "notification_provider_adapters.sandbox.mjs").read_text(encoding="utf-8")
test_entry = (root / "worker.local.entry.mjs").read_text(encoding="utf-8")
checkout = json.loads((root.parent / "checkout-config.json").read_text(encoding="utf-8"))

assert checkout["enabled"] is False and checkout["termsApproved"] is False
assert checkout["termsUrl"] is None and checkout["refundPolicyUrl"] is None
for name in ("monthly", "annual"):
    offer = checkout["offers"][name]
    assert offer["paymentLink"] is None
    assert offer["paymentMode"] == "one_time"

assert 'env.PAYMENTS_MODE === "sandbox"' in worker
assert 'env.TERMS_APPROVED === "true"' in worker
assert "Payment receiver not configured" in worker
assert "verifyStripeSignature" in worker
assert "/webhooks/stripe" in worker
assert "notification_sender.sandbox.mjs" not in worker
assert "notification_provider_adapters.sandbox.mjs" not in worker
assert "/__test/" not in worker
assert "resend.com" not in worker.lower()
assert "export default" in worker

assert 'NOTIFICATION_SEND_MODE === "sandbox_founder_test"' in sender
assert 'NOTIFICATION_OPERATOR_RELEASE === "true"' in sender
assert 'NOTIFICATION_TEMPLATES_APPROVED === "true"' in sender
assert "NOTIFICATION_TEST_RECIPIENT" in sender
assert "NOTIFICATION_RECIPIENT_HMAC_SECRET" in sender
assert "review_verified" in sender and "attempt_started" in sender
assert "export default" not in sender

assert 'NOTIFICATION_SEND_MODE === "sandbox_founder_test"' in providers
assert "templateIsPublished(templateAlias)" in providers
assert '"Idempotency-Key": idempotencyKey' in providers
assert 'if (!allowlisted || validEmail(to) !== allowlisted)' in providers
assert 'redirect: "manual"' in providers
assert "return { templateIsPublished, send }" in providers

assert 'import paymentWorker from "./worker.mjs";' in test_entry
assert 'import { dispatchFounderTestNotification' in test_entry
assert "/__test/notification/dispatch" in test_entry
assert "/__test/notification/prepare" in test_entry

print("PASS: public payment switch disabled and founder-only notification harness remains isolated")
