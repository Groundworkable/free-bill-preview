/**
 * DRAFT ONLY — isolated, independent review before notification dispatch.
 * No routes, no default network calls, no deployment or sending.
 * The caller must supply a TRUSTED, Cloudflare Access verified identity.
 * A reviewed notice can be approved only after independently retrieving the
 * exact paid test-mode Stripe session/line items, matching immutable order,
 * confirming allowlisted test recipient + HMAC, and sealing evidence.
 *
 * This module DOES NOT permit delivery-update review: approved copy evidence
 * requires a separate design. No customer-facing payment entitlement results.
 */
import { verifyPaidPurchase } from "./worker.mjs";

const keyPattern = /^gwn1_[a-f0-9]{64}$/;
const aliases = Object.freeze({
  purchase_confirmation: "groundwork-prepurchase-confirmation-review",
  refund_initiated: "groundwork-refund-initiated-review",
});
const enc = new TextEncoder();
const hex = a => Array.from(a, n => n.toString(16).padStart(2,"0")).join("");
function normEmail(value) {
  if (typeof value !== "string" || value.length > 254) return null;
  const email=value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)?email:null;
}
async function hmac(secret, text) {
  const k=await crypto.subtle.importKey("raw",enc.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC",k,enc.encode(text))));
}
function enabled(env) {
  return env?.FOUNDER_NOTIFICATION_REVIEW_ENABLED === "true" &&
    env?.FOUNDER_NOTIFICATION_ADMIN_MODE === "sandbox_access_only" &&
    env?.NOTIFICATION_SEND_MODE === "sandbox_founder_test" &&
    env?.PAYMENTS_MODE === "sandbox" && env?.TERMS_APPROVED === "true" &&
    /^prepurchase-v\d{4}-\d{2}-\d{2}$/.test(env.TERMS_VERSION || "") &&
    env?.STRIPE_TEST_SECRET_KEY?.startsWith("sk_test_") &&
    typeof env.NOTIFICATION_RECIPIENT_HMAC_SECRET === "string" &&
    env.NOTIFICATION_RECIPIENT_HMAC_SECRET.length >= 32 &&
    typeof env.NOTIFICATION_REVIEW_SEAL_SECRET === "string" &&
    env.NOTIFICATION_REVIEW_SEAL_SECRET.length >= 32 &&
    !!normEmail(env.NOTIFICATION_TEST_RECIPIENT) &&
    !!normEmail(env.FOUNDER_ACCESS_EMAIL);
}
function expectedOffers(env) {
  return [
    {link:env.MONTH_LINK_ID,price:env.MONTH_PRICE_ID,term:"monthly",amount:999,termsVersion:env.TERMS_VERSION},
    {link:env.ANNUAL_LINK_ID,price:env.ANNUAL_PRICE_ID,term:"annual",amount:9600,termsVersion:env.TERMS_VERSION},
  ];
}
function exactOrder(row, order) {
  const columns={checkout_session_id:"id",payment_intent_id:"paymentIntent",
    stripe_customer_id:"customer",payment_link_id:"link",stripe_price_id:"price",
    term:"term",terms_version:"termsVersion",subtotal_cents:"subtotal",
    tax_cents:"tax",total_cents:"total",currency:"currency",status:"status"};
  return Object.entries(columns).every(([col,key])=>row[col]===order[key]);
}
function refundValid(refund,notice,order,event) {
  return refund && refund.object==="refund" && refund.livemode===false &&
    refund.id===notice.notice_ref && /^re_[a-zA-Z0-9]+$/.test(refund.id) &&
    refund.payment_intent===order.paymentIntent &&
    refund.currency==="usd" && Number.isSafeInteger(refund.amount) &&
    refund.amount>0 && refund.amount<=order.total &&
    Number.isSafeInteger(refund.created) && refund.created>0 &&
    ["pending","requires_action","succeeded"].includes(refund.status) &&
    event?.event_type==="refund.created" &&
    event.amount_cents===refund.amount && event.currency===refund.currency;
}
export async function independentlyReviewFounderNotice(env, key, trustedReviewerEmail, adapters) {
  if (!enabled(env)) return {status:"review_disabled"};
  if (!keyPattern.test(key || "")) return {status:"invalid_reference"};
  if (normEmail(trustedReviewerEmail)!==normEmail(env.FOUNDER_ACCESS_EMAIL)) {
    return {status:"operator_identity_not_verified"};
  }
  if (!adapters?.store || !adapters?.provider || typeof adapters.store.approve!=="function") {
    return {status:"trusted_adapter_missing"};
  }
  const {store,provider}=adapters;
  const notice=await store.get(key);
  if (!notice || notice.notification_key!==key ||
      notice.state!=="review_pending" ||
      notice.review_completed_at!==null ||
      aliases[notice.notice_type]!==notice.template_alias ||
      !/^cs_test_[a-zA-Z0-9]+$/.test(notice.checkout_session_id||"") ||
      !/^[a-f0-9]{64}$/.test(notice.recipient_hmac||"") ||
      (notice.notice_type==="purchase_confirmation" && notice.notice_ref!=="purchase")) {
    return {status:"not_pending_or_unreviewable"};
  }
  try {
    const stored=await store.getOrder(notice.checkout_session_id);
    if (!stored) return {status:"order_not_found"};
    const session=await provider.checkout(notice.checkout_session_id);
    const items=await provider.lineItems(notice.checkout_session_id);
    const verified=verifyPaidPurchase(session,items,expectedOffers(env));
    if (!exactOrder(stored,verified)) return {status:"purchase_evidence_mismatch"};
    const fromDetails=normEmail(session.customer_details?.email);
    const fromSession=normEmail(session.customer_email);
    if (fromDetails && fromSession && fromDetails!==fromSession) {
      return {status:"recipient_evidence_mismatch"};
    }
    const recipient=fromDetails||fromSession;
    if (!recipient || recipient!==normEmail(env.NOTIFICATION_TEST_RECIPIENT)) {
      return {status:"recipient_evidence_mismatch"};
    }
    const recipientHash=await hmac(env.NOTIFICATION_RECIPIENT_HMAC_SECRET,recipient);
    if(recipientHash!==notice.recipient_hmac) return {status:"recipient_evidence_mismatch"};

    let refundProof=null;
    if (notice.notice_type==="refund_initiated") {
      const [refund,event]=await Promise.all([
        provider.refund(notice.notice_ref),
        store.getRefundEvent(notice.notice_ref,verified.paymentIntent),
      ]);
      if (!refundValid(refund,notice,verified,event)) {
        return {status:"refund_evidence_mismatch"};
      }
      refundProof=[refund.id,refund.amount,refund.currency,refund.status,refund.created,event.event_type];
    }
    // Seal exact source evidence, no raw recipient address or secret stored.
    const canonical=JSON.stringify([
      "groundwork-review-v1",key,notice.checkout_session_id,notice.notice_type,
      notice.notice_ref,notice.recipient_hmac,notice.template_alias,
      verified.id,verified.paymentIntent,verified.customer,verified.link,verified.price,
      verified.term,verified.termsVersion,verified.subtotal,verified.tax,verified.total,
      verified.currency,verified.status,refundProof
    ]);
    const reviewerHash=await hmac(env.NOTIFICATION_REVIEW_SEAL_SECRET,
      "reviewer-v1:"+normEmail(trustedReviewerEmail));
    const providerProof=await hmac(env.NOTIFICATION_REVIEW_SEAL_SECRET,
      "provider-v1:"+canonical);
    const reviewedAt=new Date().toISOString();
    const seal=await hmac(env.NOTIFICATION_REVIEW_SEAL_SECRET,
      "approval-v1:"+JSON.stringify([key,reviewerHash,providerProof,reviewedAt]));
    const proof={
      notification_key:key,checkout_session_id:notice.checkout_session_id,
      notice_type:notice.notice_type,notice_ref:notice.notice_ref,
      recipient_hmac:notice.recipient_hmac,reviewer_hmac:reviewerHash,
      provider_proof_hmac:providerProof,reviewed_at:reviewedAt,
      authorization_seal:seal,
    };
    // Store MUST apply insert-evidence + review_pending->review_verified atomically.
    // The draft schema trigger prevents approval without matching evidence.
    const approved=await store.approve(proof);
    return {status:approved===true?"review_verified":"review_conflict"};
  } catch {
    return {status:"evidence_unavailable"};
  }
}

export function isolatedD1ReviewStore(db) {
  return {
    async getEvidence(key) {
      return db.prepare("SELECT * FROM prepurchase_notification_review_evidence WHERE notification_key=?").bind(key).first();
    },
    async get(key) {
      return db.prepare("SELECT * FROM prepurchase_notification_outbox WHERE notification_key=?").bind(key).first();
    },
    async getOrder(id) {
      return db.prepare("SELECT * FROM prepurchase_orders WHERE checkout_session_id=?").bind(id).first();
    },
    async getRefundEvent(id,intent) {
      return db.prepare("SELECT event_type,amount_cents,currency FROM prepurchase_payment_changes WHERE object_id=? AND payment_intent_id=? AND event_type='refund.created' LIMIT 1").bind(id,intent).first();
    },
    async approve(proof) {
      // Two statements run in a D1 batch transaction, so a failed CAS leaves
      // no orphan evidence. Repeated requests are never silently successful.
      const current=await db.prepare(
        "SELECT state,review_completed_at FROM prepurchase_notification_outbox WHERE notification_key=?"
      ).bind(proof.notification_key).first();
      if (!current || current.state!=="review_pending" || current.review_completed_at!=null) return false;
      const results=await db.batch([
        db.prepare(`INSERT INTO prepurchase_notification_review_evidence(
          notification_key,checkout_session_id,notice_type,notice_ref,
          recipient_hmac,reviewer_hmac,provider_proof_hmac,reviewed_at,authorization_seal
        ) VALUES (?,?,?,?,?,?,?,?,?)`).bind(
          proof.notification_key,proof.checkout_session_id,proof.notice_type,
          proof.notice_ref,proof.recipient_hmac,proof.reviewer_hmac,
          proof.provider_proof_hmac,proof.reviewed_at,proof.authorization_seal),
        db.prepare(`UPDATE prepurchase_notification_outbox SET
          state='review_verified',review_completed_at=?,changed_at=datetime('now')
          WHERE notification_key=? AND state='review_pending'
            AND review_completed_at IS NULL RETURNING notification_key`
        ).bind(proof.reviewed_at,proof.notification_key),
      ]);
      return results?.[1]?.results?.length===1 &&
        results[1].results[0]?.notification_key===proof.notification_key;
    },
  };
}

/**
 * Read-only dispatch gate. An outbox state flag or review timestamp alone
 * cannot authorize email. Verify immutable signed proof and the exact notice.
 * The notification sender rechecks the Stripe/provider evidence separately.
 */
export async function verifyFounderReviewSeal(env,notice,proof) {
  if (!proof || !notice || !enabled(env)) return false;
  if (notice.state!=="review_verified" || !notice.review_completed_at) return false;
  const fields=["notification_key","checkout_session_id","notice_type",
    "notice_ref","recipient_hmac"];
  if (fields.some(k=>notice[k]!==proof[k])) return false;
  if (proof.reviewed_at!==notice.review_completed_at ||
      !/^[a-f0-9]{64}$/.test(proof.reviewer_hmac||"") ||
      !/^[a-f0-9]{64}$/.test(proof.provider_proof_hmac||"") ||
      !/^[a-f0-9]{64}$/.test(proof.authorization_seal||"")) return false;
  const reviewerHash=await hmac(env.NOTIFICATION_REVIEW_SEAL_SECRET,
    "reviewer-v1:"+normEmail(env.FOUNDER_ACCESS_EMAIL));
  if(proof.reviewer_hmac!==reviewerHash) return false;
  const expected=await hmac(env.NOTIFICATION_REVIEW_SEAL_SECRET,
    "approval-v1:"+JSON.stringify([
      proof.notification_key,proof.reviewer_hmac,proof.provider_proof_hmac,
      proof.reviewed_at,
    ]));
  return proof.authorization_seal===expected;
}
