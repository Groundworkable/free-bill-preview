SELECT 'pending_notification' AS check_name,
  CASE WHEN (SELECT COUNT(*) FROM prepurchase_notification_outbox
       WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999' AND state='review_pending' AND review_completed_at IS NULL
       AND recipient_hmac='0000000000000000000000000000000000000000000000000000000000000000')=1 THEN 'PASS' ELSE 'STOP' END AS status
UNION ALL SELECT 'initial_audit_only',CASE WHEN
  (SELECT COUNT(*) FROM prepurchase_notification_state_journal WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999')=1
  AND EXISTS (SELECT 1 FROM prepurchase_notification_state_journal
      WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999' AND old_state IS NULL AND new_state='review_pending')
  THEN 'PASS' ELSE 'STOP' END
UNION ALL SELECT 'no_review_evidence',CASE WHEN NOT EXISTS
  (SELECT 1 FROM prepurchase_notification_review_evidence WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999')
  THEN 'PASS' ELSE 'STOP' END
UNION ALL SELECT 'no_processed_stripe_event',CASE WHEN NOT EXISTS
  (SELECT 1 FROM stripe_processed_events WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115')
  THEN 'PASS' ELSE 'STOP' END;
