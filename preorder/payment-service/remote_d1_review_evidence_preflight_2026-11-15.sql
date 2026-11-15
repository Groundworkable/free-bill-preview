WITH expected(kind,object_name) AS (
  VALUES
  ('table','prepurchase_notification_review_evidence'),
  ('trigger','notification_review_evidence_guard_insert'),
  ('trigger','notification_review_evidence_block_update'),
  ('trigger','notification_review_evidence_block_delete'),
  ('trigger','notification_outbox_requires_review_evidence')
)
SELECT e.kind,e.object_name,
       CASE WHEN m.name IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS status
FROM expected e LEFT JOIN sqlite_master m
ON e.kind=m.type AND e.object_name=m.name
ORDER BY e.kind,e.object_name;
