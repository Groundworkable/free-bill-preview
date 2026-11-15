WITH expected(kind, object_name, clause_a, clause_b, clause_c) AS (
  VALUES
    ('table','prepurchase_notification_outbox','notification_key text primary key not null','unique (checkout_session_id,notice_type,notice_ref)','recipient_hmac text not null'),
    ('table','prepurchase_notification_state_journal','notification_key text not null','references prepurchase_notification_outbox(notification_key)','old_state text'),
    ('index','idx_notice_review_state','on prepurchase_notification_outbox(state,changed_at)','',''),
    ('trigger','notification_outbox_create_only_pending','before insert on prepurchase_notification_outbox','notice must enter review_pending; no direct send authorization',''),
    ('trigger','notification_outbox_guard_transition','before update on prepurchase_notification_outbox','immutable notification identity','unsafe or repeated notification state transition'),
    ('trigger','notification_outbox_block_delete','before delete on prepurchase_notification_outbox','notification outbox is append-only for identities',''),
    ('trigger','notification_outbox_audit_insert','after insert on prepurchase_notification_outbox','insert into prepurchase_notification_state_journal','new.state'),
    ('trigger','notification_outbox_audit_transition','after update on prepurchase_notification_outbox','insert into prepurchase_notification_state_journal','old.state'),
    ('trigger','notification_state_journal_block_update','before update on prepurchase_notification_state_journal','notification state journal is append-only',''),
    ('trigger','notification_state_journal_block_delete','before delete on prepurchase_notification_state_journal','notification state journal is append-only','')
)
SELECT expected.kind,
       expected.object_name,
       CASE
         WHEN m.name IS NULL THEN 'MISSING'
         WHEN instr(lower(coalesce(m.sql,'')),expected.clause_a) = 0 THEN 'REVIEW_DEFINITION'
         WHEN expected.clause_b != '' AND instr(lower(coalesce(m.sql,'')),expected.clause_b) = 0 THEN 'REVIEW_DEFINITION'
         WHEN expected.clause_c != '' AND instr(lower(coalesce(m.sql,'')),expected.clause_c) = 0 THEN 'REVIEW_DEFINITION'
         ELSE 'KEY_CLAUSES_FOUND'
       END AS definition_check
FROM expected
LEFT JOIN sqlite_master m
  ON m.type = expected.kind AND m.name = expected.object_name
ORDER BY expected.kind, expected.object_name;
