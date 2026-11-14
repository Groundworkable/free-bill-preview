-- READ ONLY. Run ONLY in the Cloudflare D1 Console for database
-- "groundwork-payment-sandbox-isolated"; never in the production Groundwork database.
-- This query performs zero writes and does not expose customer/order information.
-- It checks object existence, NOT the deployed Worker's code or secret configuration.
WITH required(kind, object_name) AS (
  VALUES
    ('table','stripe_processed_events'),
    ('table','prepurchase_orders'),
    ('table','prepurchase_payment_changes'),
    ('trigger','prepurchase_changes_block_update'),
    ('trigger','prepurchase_changes_block_delete'),
    ('trigger','prepurchase_orders_block_update'),
    ('trigger','prepurchase_orders_block_delete')
)
SELECT required.kind,
       required.object_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM sqlite_master AS existing
         WHERE existing.type = required.kind AND existing.name = required.object_name
       ) THEN 'PRESENT' ELSE 'MISSING' END AS status
FROM required
ORDER BY required.kind, required.object_name;
