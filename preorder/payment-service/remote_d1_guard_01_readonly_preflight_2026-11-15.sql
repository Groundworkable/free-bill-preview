SELECT 'prepurchase_orders' AS record_type, COUNT(*) AS existing_fixture_rows
FROM prepurchase_orders WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115'
UNION ALL
SELECT 'prepurchase_notification_outbox', COUNT(*)
FROM prepurchase_notification_outbox WHERE notification_key='gwn1_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
UNION ALL
SELECT 'prepurchase_notification_state_journal', COUNT(*)
FROM prepurchase_notification_state_journal WHERE notification_key='gwn1_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
UNION ALL
SELECT 'stripe_processed_events', COUNT(*)
FROM stripe_processed_events WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115'
UNION ALL
SELECT 'prepurchase_payment_changes', COUNT(*)
FROM prepurchase_payment_changes WHERE payment_intent_id='pi_FAKE_D1ONLY_GUARD_20261115';
