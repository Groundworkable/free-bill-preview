INSERT INTO prepurchase_notification_outbox
  (notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias)
SELECT
  'gwn1_9999999999999999999999999999999999999999999999999999999999999999','cs_test_D1ONLY_GUARD_20261115','purchase_confirmation','purchase',
  '0000000000000000000000000000000000000000000000000000000000000000','groundwork-prepurchase-confirmation-review'
WHERE EXISTS (SELECT 1 FROM prepurchase_orders
  WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115'
    AND payment_intent_id='pi_FAKE_D1ONLY_GUARD_20261115'
    AND payment_link_id='plink_FAKE_NO_PAYMENT_D1ONLY'
    AND status='paid_unfulfilled')
AND NOT EXISTS (SELECT 1 FROM prepurchase_notification_outbox
  WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999')
AND NOT EXISTS (SELECT 1 FROM prepurchase_notification_outbox
  WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115'
    AND notice_type='purchase_confirmation' AND notice_ref='purchase');
