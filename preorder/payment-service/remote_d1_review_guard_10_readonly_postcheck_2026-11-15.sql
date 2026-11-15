WITH checks(check_name, status) AS (
  VALUES
    ('notification_still_pending',
 CASE WHEN (SELECT COUNT(*) FROM prepurchase_notification_outbox
    WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999' AND state='review_pending' AND review_completed_at IS NULL)=1
 THEN 'PASS' ELSE 'FAIL' END),
    ('synthetic_evidence_retained_unchanged',CASE WHEN
 (SELECT COUNT(*) FROM prepurchase_notification_review_evidence
   WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999' AND notice_ref='purchase'
   AND recipient_hmac='0000000000000000000000000000000000000000000000000000000000000000' AND reviewer_hmac='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
   AND provider_proof_hmac='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
   AND authorization_seal='cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
   AND reviewed_at='2026-11-15T12:00:00.000Z')=1
 THEN 'PASS' ELSE 'FAIL' END),
    ('journal_still_initial_only',CASE WHEN
 (SELECT COUNT(*) FROM prepurchase_notification_state_journal
   WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999')=1 AND EXISTS
 (SELECT 1 FROM prepurchase_notification_state_journal WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999'
   AND old_state IS NULL AND new_state='review_pending')
 THEN 'PASS' ELSE 'FAIL' END),
    ('not_review_verified',CASE WHEN NOT EXISTS
 (SELECT 1 FROM prepurchase_notification_outbox
  WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999' AND state='review_verified')
 THEN 'PASS' ELSE 'FAIL' END),
    ('no_provider_payment_event',CASE WHEN NOT EXISTS
 (SELECT 1 FROM stripe_processed_events WHERE checkout_session_id='cs_test_D1ONLY_GUARD_20261115')
 THEN 'PASS' ELSE 'FAIL' END),
    ('no_financial_change',CASE WHEN NOT EXISTS
 (SELECT 1 FROM prepurchase_payment_changes WHERE payment_intent_id='pi_FAKE_D1ONLY_GUARD_20261115')
 THEN 'PASS' ELSE 'FAIL' END)
)
SELECT check_name, status FROM checks;
