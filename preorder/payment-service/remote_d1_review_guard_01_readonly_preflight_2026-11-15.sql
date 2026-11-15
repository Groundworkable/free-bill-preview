WITH checks(check_name, status) AS (
  VALUES
    ('fake_order_matches_prior_sandbox_fixture',
 CASE WHEN EXISTS (SELECT 1 FROM prepurchase_orders WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115' AND payment_intent_id='pi_FAKE_D1ONLY_GUARD_20261115' AND payment_link_id='plink_FAKE_NO_PAYMENT_D1ONLY' AND status='paid_unfulfilled') THEN 'READY' ELSE 'STOP' END),
    ('notification_key_unused', CASE WHEN NOT EXISTS (SELECT 1 FROM prepurchase_notification_outbox WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999') THEN 'READY' ELSE 'STOP' END),
    ('notice_identity_unused', CASE WHEN NOT EXISTS (SELECT 1 FROM prepurchase_notification_outbox WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115' AND notice_type='purchase_confirmation' AND notice_ref='purchase') THEN 'READY' ELSE 'STOP' END),
    ('review_evidence_absent', CASE WHEN NOT EXISTS (SELECT 1 FROM prepurchase_notification_review_evidence WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999') THEN 'READY' ELSE 'STOP' END),
    ('journal_absent', CASE WHEN NOT EXISTS (SELECT 1 FROM prepurchase_notification_state_journal WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999') THEN 'READY' ELSE 'STOP' END),
    ('no_processed_stripe_event', CASE WHEN NOT EXISTS (SELECT 1 FROM stripe_processed_events WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115') THEN 'READY' ELSE 'STOP' END)
)
SELECT check_name, status FROM checks;
