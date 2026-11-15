UPDATE prepurchase_notification_outbox
SET state='review_verified',review_completed_at='2026-11-15T12:00:00.000Z',changed_at=datetime('now')
WHERE notification_key='gwn1_9999999999999999999999999999999999999999999999999999999999999999' AND state='review_pending';
