CREATE TABLE IF NOT EXISTS prepurchase_notification_review_evidence (
  notification_key TEXT PRIMARY KEY NOT NULL
    REFERENCES prepurchase_notification_outbox(notification_key),
  checkout_session_id TEXT NOT NULL,
  notice_type TEXT NOT NULL CHECK (notice_type IN ('purchase_confirmation','refund_initiated')),
  notice_ref TEXT NOT NULL,
  recipient_hmac TEXT NOT NULL
    CHECK (length(recipient_hmac)=64 AND recipient_hmac NOT GLOB '*[^0-9a-f]*'),
  reviewer_hmac TEXT NOT NULL
    CHECK (length(reviewer_hmac)=64 AND reviewer_hmac NOT GLOB '*[^0-9a-f]*'),
  provider_proof_hmac TEXT NOT NULL
    CHECK (length(provider_proof_hmac)=64 AND provider_proof_hmac NOT GLOB '*[^0-9a-f]*'),
  reviewed_at TEXT NOT NULL CHECK (length(reviewed_at) BETWEEN 20 AND 32),
  authorization_seal TEXT NOT NULL
    CHECK (length(authorization_seal)=64 AND authorization_seal NOT GLOB '*[^0-9a-f]*')
);

CREATE TRIGGER IF NOT EXISTS notification_review_evidence_guard_insert
BEFORE INSERT ON prepurchase_notification_review_evidence
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM prepurchase_notification_outbox AS notice
     WHERE notice.notification_key=NEW.notification_key
       AND notice.checkout_session_id=NEW.checkout_session_id
       AND notice.notice_type=NEW.notice_type
       AND notice.notice_ref=NEW.notice_ref
       AND notice.recipient_hmac=NEW.recipient_hmac
       AND notice.state='review_pending'
  ) THEN RAISE(ABORT,'review evidence must bind to a pending notice') END;
END;

CREATE TRIGGER IF NOT EXISTS notification_review_evidence_block_update
BEFORE UPDATE ON prepurchase_notification_review_evidence
BEGIN
  SELECT RAISE(ABORT,'review evidence is append-only');
END;

CREATE TRIGGER IF NOT EXISTS notification_review_evidence_block_delete
BEFORE DELETE ON prepurchase_notification_review_evidence
BEGIN
  SELECT RAISE(ABORT,'review evidence is append-only');
END;

CREATE TRIGGER IF NOT EXISTS notification_outbox_requires_review_evidence
BEFORE UPDATE OF state ON prepurchase_notification_outbox
WHEN NEW.state='review_verified'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM prepurchase_notification_review_evidence AS proof
     WHERE proof.notification_key=NEW.notification_key
       AND proof.checkout_session_id=NEW.checkout_session_id
       AND proof.notice_type=NEW.notice_type
       AND proof.notice_ref=NEW.notice_ref
       AND proof.recipient_hmac=NEW.recipient_hmac
       AND proof.reviewed_at=NEW.review_completed_at
  ) THEN RAISE(ABORT,'independent review evidence required before approval') END;
END;
