UPDATE prepurchase_notification_outbox
SET state='manual_review', changed_at=datetime('now')
WHERE notification_key='gwn1_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' AND state='review_pending';
