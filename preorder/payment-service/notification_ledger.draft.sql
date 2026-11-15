-- DRAFT ONLY. Separate Groundwork payment SANDBOX D1; NOT MIGRATED OR DEPLOYED.
-- This ledger is NOT a sender and never authorizes a customer notification.
-- An ambiguous send attempt must be manually reconciled: NEVER auto-reset it.
-- Recipient fingerprint must be an HMAC with a separate secret, NOT plain SHA(email).
CREATE TABLE IF NOT EXISTS prepurchase_notification_outbox (
  notification_key TEXT PRIMARY KEY
    CHECK (length(notification_key) = 69 AND substr(notification_key,1,5) = 'gwn1_'),
  checkout_session_id TEXT NOT NULL REFERENCES prepurchase_orders(checkout_session_id),
  notice_type TEXT NOT NULL
    CHECK (notice_type IN ('purchase_confirmation','delivery_update','refund_initiated')),
  notice_ref TEXT NOT NULL CHECK (length(notice_ref) BETWEEN 1 AND 128),
  recipient_hmac TEXT NOT NULL
    CHECK (length(recipient_hmac) = 64 AND recipient_hmac NOT GLOB '*[^0-9a-f]*'),
  template_alias TEXT NOT NULL
    CHECK (template_alias IN (
      'groundwork-prepurchase-confirmation-review',
      'groundwork-prepurchase-delivery-update-review',
      'groundwork-refund-initiated-review'
    )),
  state TEXT NOT NULL DEFAULT 'review_pending'
    CHECK (state IN (
      'review_pending','review_verified','attempt_started',
      'provider_accepted','delivered','manual_review'
    )),
  review_completed_at TEXT,
  attempt_token TEXT UNIQUE,
  attempt_started_at TEXT,
  provider_message_id TEXT UNIQUE,
  provider_accepted_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (checkout_session_id,notice_type,notice_ref),
  CHECK (state NOT IN ('attempt_started','provider_accepted','delivered')
    OR (attempt_token IS NOT NULL AND attempt_started_at IS NOT NULL)),
  CHECK (state NOT IN ('provider_accepted','delivered')
    OR (provider_message_id IS NOT NULL AND provider_accepted_at IS NOT NULL)),
  CHECK (state != 'delivered' OR delivered_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_notice_review_state
ON prepurchase_notification_outbox(state,changed_at);

CREATE TABLE IF NOT EXISTS prepurchase_notification_state_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_key TEXT NOT NULL
    REFERENCES prepurchase_notification_outbox(notification_key),
  old_state TEXT,
  new_state TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS notification_outbox_create_only_pending
BEFORE INSERT ON prepurchase_notification_outbox
BEGIN
  SELECT CASE WHEN NEW.state != 'review_pending'
    OR NEW.review_completed_at IS NOT NULL OR NEW.attempt_token IS NOT NULL
    OR NEW.attempt_started_at IS NOT NULL OR NEW.provider_message_id IS NOT NULL
    OR NEW.provider_accepted_at IS NOT NULL OR NEW.delivered_at IS NOT NULL
  THEN RAISE(ABORT,'notice must enter review_pending; no direct send authorization') END;
END;

CREATE TRIGGER IF NOT EXISTS notification_outbox_guard_transition
BEFORE UPDATE ON prepurchase_notification_outbox
BEGIN
  SELECT CASE WHEN NEW.notification_key IS NOT OLD.notification_key
    OR NEW.checkout_session_id IS NOT OLD.checkout_session_id
    OR NEW.notice_type IS NOT OLD.notice_type
    OR NEW.notice_ref IS NOT OLD.notice_ref
    OR NEW.recipient_hmac IS NOT OLD.recipient_hmac
    OR NEW.template_alias IS NOT OLD.template_alias
    OR NEW.created_at IS NOT OLD.created_at
  THEN RAISE(ABORT,'immutable notification identity') END;
  SELECT CASE WHEN NOT (
    (OLD.state = 'review_pending' AND NEW.state IN ('review_verified','manual_review'))
    OR (OLD.state = 'review_verified' AND NEW.state IN ('attempt_started','manual_review'))
    OR (OLD.state = 'attempt_started' AND NEW.state IN ('provider_accepted','manual_review'))
    OR (OLD.state = 'provider_accepted' AND NEW.state IN ('delivered','manual_review'))
  ) THEN RAISE(ABORT,'unsafe or repeated notification state transition') END;
  SELECT CASE WHEN
    (NEW.state = 'review_verified' AND NEW.review_completed_at IS NULL)
    OR (NEW.state = 'attempt_started' AND
        (NEW.attempt_token IS NULL OR NEW.attempt_started_at IS NULL))
    OR (NEW.state = 'provider_accepted' AND
        (NEW.provider_message_id IS NULL OR NEW.provider_accepted_at IS NULL))
    OR (NEW.state = 'delivered' AND NEW.delivered_at IS NULL)
  THEN RAISE(ABORT,'missing evidence for notification transition') END;
  SELECT CASE WHEN
    (OLD.attempt_token IS NOT NULL AND OLD.attempt_token IS NOT NEW.attempt_token)
    OR (OLD.provider_message_id IS NOT NULL
        AND OLD.provider_message_id IS NOT NEW.provider_message_id)
    OR (OLD.review_completed_at IS NOT NULL
        AND OLD.review_completed_at IS NOT NEW.review_completed_at)
    OR (OLD.attempt_started_at IS NOT NULL
        AND OLD.attempt_started_at IS NOT NEW.attempt_started_at)
    OR (OLD.provider_accepted_at IS NOT NULL
        AND OLD.provider_accepted_at IS NOT NEW.provider_accepted_at)
    OR (OLD.delivered_at IS NOT NULL AND OLD.delivered_at IS NOT NEW.delivered_at)
  THEN RAISE(ABORT,'notification evidence cannot be erased or rewritten') END;
END;

CREATE TRIGGER IF NOT EXISTS notification_outbox_block_delete
BEFORE DELETE ON prepurchase_notification_outbox
BEGIN
  SELECT RAISE(ABORT,'notification outbox is append-only for identities');
END;

CREATE TRIGGER IF NOT EXISTS notification_outbox_audit_insert
AFTER INSERT ON prepurchase_notification_outbox
BEGIN
  INSERT INTO prepurchase_notification_state_journal(notification_key,old_state,new_state)
  VALUES (NEW.notification_key,NULL,NEW.state);
END;

CREATE TRIGGER IF NOT EXISTS notification_outbox_audit_transition
AFTER UPDATE ON prepurchase_notification_outbox
BEGIN
  INSERT INTO prepurchase_notification_state_journal(notification_key,old_state,new_state)
  VALUES (NEW.notification_key,OLD.state,NEW.state);
END;

CREATE TRIGGER IF NOT EXISTS notification_state_journal_block_update
BEFORE UPDATE ON prepurchase_notification_state_journal
BEGIN
  SELECT RAISE(ABORT,'notification state journal is append-only');
END;

CREATE TRIGGER IF NOT EXISTS notification_state_journal_block_delete
BEFORE DELETE ON prepurchase_notification_state_journal
BEGIN
  SELECT RAISE(ABORT,'notification state journal is append-only');
END;
