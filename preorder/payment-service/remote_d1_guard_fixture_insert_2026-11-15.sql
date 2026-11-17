INSERT INTO prepurchase_orders
  (checkout_session_id,payment_intent_id,stripe_customer_id,payment_link_id,
   stripe_price_id,term,terms_version,subtotal_cents,tax_cents,total_cents,
   currency,status)
SELECT
  'cs_test_D1ONLY_GUARD_20261115','pi_FAKE_D1ONLY_GUARD_20261115',NULL,
  'plink_FAKE_NO_PAYMENT_D1ONLY','price_FAKE_NO_PAYMENT_D1ONLY',
  'monthly','prepurchase-v2026-11-15',1,0,1,'usd','paid_unfulfilled'
WHERE NOT EXISTS (
  SELECT 1 FROM prepurchase_orders
  WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115'
);

INSERT INTO prepurchase_notification_outbox
  (notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,
   template_alias)
SELECT
  'gwn1_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','cs_test_D1ONLY_GUARD_20261115',
  'delivery_update','D1_ONLY_NO_DELIVERY_20261115',
  '0000000000000000000000000000000000000000000000000000000000000000','groundwork-prepurchase-delivery-update-review'
WHERE EXISTS (
  SELECT 1 FROM prepurchase_orders
  WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115'
    AND payment_intent_id='pi_FAKE_D1ONLY_GUARD_20261115'
    AND payment_link_id='plink_FAKE_NO_PAYMENT_D1ONLY'
)
AND NOT EXISTS (
  SELECT 1 FROM prepurchase_notification_outbox
  WHERE notification_key='gwn1_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
);
