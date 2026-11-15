WITH expected(kind,object_name,clause) AS (
  VALUES
  ('table','prepurchase_notification_review_evidence','authorization_seal'),
  ('trigger','notification_review_evidence_guard_insert','review evidence must bind to a pending notice'),
  ('trigger','notification_review_evidence_block_update','review evidence is append-only'),
  ('trigger','notification_review_evidence_block_delete','review evidence is append-only'),
  ('trigger','notification_outbox_requires_review_evidence','independent review evidence required before approval')
)
SELECT e.kind,e.object_name,
       CASE WHEN m.name IS NULL THEN 'MISSING'
            WHEN instr(lower(coalesce(m.sql,'')),e.clause)=0 THEN 'REVIEW_DEFINITION'
            ELSE 'KEY_CLAUSES_FOUND' END AS verification
FROM expected e LEFT JOIN sqlite_master m
ON e.kind=m.type AND e.object_name=m.name
ORDER BY e.kind,e.object_name;
