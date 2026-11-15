WITH required(scope, kind, object_name) AS (
  VALUES
    ('deployed_payment','table','stripe_processed_events'),
    ('deployed_payment','table','prepurchase_orders'),
    ('deployed_payment','table','prepurchase_payment_changes'),
    ('deployed_payment','trigger','prepurchase_changes_block_update'),
    ('deployed_payment','trigger','prepurchase_changes_block_delete'),
    ('deployed_payment','trigger','prepurchase_orders_block_update'),
    ('deployed_payment','trigger','prepurchase_orders_block_delete'),
    ('draft_notifications','table','prepurchase_notification_outbox'),
    ('draft_notifications','table','prepurchase_notification_state_journal'),
    ('draft_notifications','index','idx_notice_review_state'),
    ('draft_notifications','trigger','notification_outbox_create_only_pending'),
    ('draft_notifications','trigger','notification_outbox_guard_transition'),
    ('draft_notifications','trigger','notification_outbox_block_delete'),
    ('draft_notifications','trigger','notification_outbox_audit_insert'),
    ('draft_notifications','trigger','notification_outbox_audit_transition'),
    ('draft_notifications','trigger','notification_state_journal_block_update'),
    ('draft_notifications','trigger','notification_state_journal_block_delete')
)
SELECT required.scope,
       required.kind,
       required.object_name,
       CASE WHEN sqlite_master.name IS NOT NULL THEN 'PRESENT'
            ELSE 'MISSING' END AS status
FROM required
LEFT JOIN sqlite_master
  ON sqlite_master.type = required.kind
 AND sqlite_master.name = required.object_name
ORDER BY required.scope, required.kind, required.object_name;
