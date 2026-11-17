SELECT 'order' AS object_type, checkout_session_id AS identifier,
  status AS value, payment_intent_id AS detail
FROM prepurchase_orders WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115'
UNION ALL
SELECT 'notification',notification_key,state,notice_ref
FROM prepurchase_notification_outbox WHERE notification_key='gwn1_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
UNION ALL
SELECT 'journal',notification_key,new_state,coalesce(old_state,'FIRST')
FROM prepurchase_notification_state_journal WHERE notification_key='gwn1_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
ORDER BY object_type, value;
