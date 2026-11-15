/**
 * DRAFT ONLY: founder-only isolated notification sender orchestration.
 * NO fetch handler, NO deployed routes, NO provider adapters or default secrets.
 * This module cannot send on its own. The test-only adapter is externally supplied.
 * A matching Stripe email is NOT proof of customer identity; this workflow is
 * restricted to a separately authorized founder-controlled test destination.
 */
import { verifyPaidPurchase } from "./worker.mjs";

const aliasForType = Object.freeze({
  purchase_confirmation: "groundwork-prepurchase-confirmation-review",
  delivery_update: "groundwork-prepurchase-delivery-update-review",
  refund_initiated: "groundwork-refund-initiated-review",
});
const keyPattern = /^gwn1_[0-9a-f]{64}$/;
const testEmailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function allowed(env) {
  return env?.NOTIFICATION_SEND_MODE === "sandbox_founder_test" &&
    env?.NOTIFICATION_OPERATOR_RELEASE === "true" &&
    env?.NOTIFICATION_TEMPLATES_APPROVED === "true" &&
    env?.PAYMENTS_MODE === "sandbox" &&
    env?.TERMS_APPROVED === "true" &&
    /^prepurchase-v\d{4}-\d{2}-\d{2}$/.test(env?.TERMS_VERSION || "") &&
    env?.STRIPE_TEST_SECRET_KEY?.startsWith("sk_test_") &&
    env?.RESEND_API_KEY?.startsWith("re_") &&
    typeof env?.NOTIFICATION_TEST_RECIPIENT === "string" &&
    testEmailPattern.test(env.NOTIFICATION_TEST_RECIPIENT) &&
    typeof env?.NOTIFICATION_RECIPIENT_HMAC_SECRET === "string" &&
    env.NOTIFICATION_RECIPIENT_HMAC_SECRET.length >= 32;
}

function normalizedEmail(email) {
  if (typeof email !== "string" || email.length > 254) return null;
  const value = email.trim().toLowerCase();
  return testEmailPattern.test(value) ? value : null;
}

async function recipientFingerprint(email, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(email)));
  return Array.from(result, byte => byte.toString(16).padStart(2,"0")).join("");
}

function checkedOrder(row, verified) {
  const keys = {
    checkout_session_id: "id", payment_intent_id: "paymentIntent",
    stripe_customer_id: "customer", payment_link_id: "link", stripe_price_id: "price",
    term: "term", terms_version: "termsVersion", subtotal_cents: "subtotal",
    tax_cents: "tax", total_cents: "total", currency: "currency", status: "status",
  };
  return Object.entries(keys).every(([column, field]) => row[column] === verified[field]);
}

function offerSet(env) {
  return [
    { link: env.MONTH_LINK_ID, price: env.MONTH_PRICE_ID, term: "monthly", amount: 999, termsVersion: env.TERMS_VERSION },
    { link: env.ANNUAL_LINK_ID, price: env.ANNUAL_PRICE_ID, term: "annual", amount: 9600, termsVersion: env.TERMS_VERSION },
  ];
}
const dollars = cents => "$" + (cents / 100).toFixed(2);

function variablesFor(row, order, additional) {
  const common = { ORDER_REFERENCE: order.id };
  if (row.notice_type === "purchase_confirmation") {
    if (row.notice_ref !== "purchase") throw new Error("Unexpected confirmation identity");
    const schedule = order.term === "annual"
      ? "Twelve purchased months: January 2027 and March 2027 through January 2028; February 2027 complimentary. Usable access is subject to delivery."
      : "January 2027 purchased month; February 2027 complimentary. Usable access is subject to delivery.";
    return { ...common, OFFER_NAME: order.term === "annual" ? "Annual one-time pre-purchase" : "Monthly one-time pre-purchase",
      SUBTOTAL: dollars(order.subtotal), TAX: dollars(order.tax), TOTAL_PAID: dollars(order.total),
      ACCESS_SCHEDULE: schedule };
  }
  if (row.notice_type === "delivery_update") {
    if (!additional || typeof additional.status !== "string" ||
        typeof additional.nextStep !== "string" || !additional.approved ||
        additional.status.length > 280 || additional.nextStep.length > 280 ||
        row.notice_ref.length > 80) throw new Error("Unreviewed delivery notice");
    return { ...common, UPDATE_DATE: row.notice_ref,
      DELIVERY_STATUS: additional.status, NEXT_STEP: additional.nextStep };
  }
  if (row.notice_type === "refund_initiated") {
    if (!additional || additional.object !== "refund" ||
        additional.livemode !== false || additional.id !== row.notice_ref ||
        !/^re_[A-Za-z0-9]+$/.test(additional.id) ||
        additional.payment_intent !== order.paymentIntent ||
        additional.currency !== "usd" ||
        !Number.isSafeInteger(additional.amount) || additional.amount <= 0 ||
        additional.amount > order.total || !Number.isSafeInteger(additional.created) ||
        additional.created <= 0 || !["pending","requires_action","succeeded"].includes(additional.status)) {
      throw new Error("Unverified refund initiation");
    }
    return { ...common, REFUND_REFERENCE: additional.id,
      REFUND_AMOUNT: dollars(additional.amount),
      INITIATED_DATE: new Date(additional.created * 1000).toISOString().slice(0,10) };
  }
  throw new Error("Unknown notice");
}

/**
 * All adapters must be trusted internal dependencies, never arbitrary network
 * request arguments. approval() must verify a separate founder authorization;
 * provider must fetch authenticated Stripe TEST snapshots and exact line items;
 * transport must verify Resend template publication before sending.
 *
 * store.claim() MUST be atomic: UPDATE ... WHERE state='review_verified'
 * AND notification_key=?, with exactly one changed row. Never auto-retry after
 * any attempted provider call, including a transport timeout.
 */
export async function dispatchFounderTestNotification(env, notificationKey, adapters) {
  if (!allowed(env)) return { status: "disabled" };
  if (!keyPattern.test(notificationKey || "")) return { status: "invalid_reference" };
  if (!adapters || !["store","provider","transport","approval"].every(k => adapters[k])) {
    return { status: "missing_trusted_adapter" };
  }
  const { store, provider, transport, approval } = adapters;
  const row = await store.get(notificationKey);
  if (!row || row.state !== "review_verified" || row.notification_key !== notificationKey ||
      aliasForType[row.notice_type] !== row.template_alias ||
      !/^cs_test_[A-Za-z0-9]+$/.test(row.checkout_session_id || "") ||
      !/^[a-f0-9]{64}$/.test(row.recipient_hmac || "")) {
    return { status: "not_reviewed_or_inconsistent" };
  }
  if (await approval.isAuthorized(notificationKey, row) !== true) {
    return { status: "operator_approval_missing" };
  }
  if (await transport.templateIsPublished(row.template_alias) !== true) {
    return { status: "template_unpublished" };
  }

  const storedOrder = await store.getOrder(row.checkout_session_id);
  if (!storedOrder) return { status: "order_not_found" };
  let verified, email, additional;
  try {
    const session = await provider.checkout(row.checkout_session_id);
    const items = await provider.lineItems(row.checkout_session_id);
    verified = verifyPaidPurchase(session, items, offerSet(env));
    if (!checkedOrder(storedOrder, verified)) throw new Error("Mismatch");
    const first = normalizedEmail(session.customer_details?.email);
    const second = normalizedEmail(session.customer_email);
    if (first && second && first !== second) throw new Error("Email conflict");
    email = first || second;
    if (!email || email !== normalizedEmail(env.NOTIFICATION_TEST_RECIPIENT)) {
      throw new Error("Recipient not test-allowlisted");
    }
    const digest = await recipientFingerprint(email, env.NOTIFICATION_RECIPIENT_HMAC_SECRET);
    if (digest !== row.recipient_hmac) throw new Error("Recipient evidence mismatch");
    if (row.notice_type === "refund_initiated") {
      additional = await provider.refund(row.notice_ref);
      const journal = await store.getRefundEvent(row.notice_ref, verified.paymentIntent);
      if (!journal || journal.event_type !== "refund.created" ||
          journal.amount_cents !== additional.amount ||
          journal.currency !== additional.currency) throw new Error("No corroborated refund notification");
    }
    if (row.notice_type === "delivery_update") {
      additional = await approval.deliveryCopy(row.notice_ref, row);
    }
  } catch {
    return { status: "evidence_failed" };
  }

  let variables;
  try { variables = variablesFor(row, verified, additional); }
  catch { return { status: "notice_content_not_verified" }; }
  // Re-check the publish/approval boundary before the irreversible DB claim.
  if (await approval.isAuthorized(notificationKey, row) !== true ||
      await transport.templateIsPublished(row.template_alias) !== true) {
    return { status: "approval_or_template_changed" };
  }

  // This claim is the only accepted concurrency gate. Provider calls follow it.
  const attemptToken = notificationKey; // stable idempotency token, no PII
  const claimed = await store.claim(notificationKey, attemptToken);
  if (claimed !== true) return { status: "already_claimed_or_ineligible" };
  try {
    const receipt = await transport.send({
      to: email, templateAlias: row.template_alias, variables,
      idempotencyKey: notificationKey, from: "Groundwork by Able <billing@groundworkbyable.com>",
    });
    if (!receipt || !/^[0-9a-f-]{20,64}$/i.test(receipt.id || "")) {
      return { status: "ambiguous_send_manual_reconciliation" };
    }
    const recorded = await store.providerAccepted(notificationKey, attemptToken, receipt.id);
    if (recorded !== true) return { status: "provider_accepted_ledger_needs_reconciliation" };
    return { status: "provider_accepted_await_delivery_evidence" };
  } catch {
    // Never automatically send again: provider may already have accepted.
    return { status: "ambiguous_send_manual_reconciliation" };
  }
}

/** Cloudflare D1 storage adapter for future reviewed isolated binding ONLY. */
export function isolatedD1NotificationStore(db) {
  return {
    async get(key) { return db.prepare("SELECT * FROM prepurchase_notification_outbox WHERE notification_key=?").bind(key).first(); },
    async getOrder(session) { return db.prepare("SELECT * FROM prepurchase_orders WHERE checkout_session_id=?").bind(session).first(); },
    async getRefundEvent(refund, intent) {
      return db.prepare(
        "SELECT event_type,amount_cents,currency FROM prepurchase_payment_changes WHERE object_id=? AND payment_intent_id=? AND event_type='refund.created' LIMIT 1"
      ).bind(refund, intent).first();
    },
    async claim(key, token) {
      const result = await db.prepare(
        "UPDATE prepurchase_notification_outbox SET state='attempt_started',attempt_token=?,attempt_started_at=datetime('now'),changed_at=datetime('now') WHERE notification_key=? AND state='review_verified'"
      ).bind(token,key).run();
      return result.meta?.changes === 1;
    },
    async providerAccepted(key, token, messageId) {
      const result = await db.prepare(
        "UPDATE prepurchase_notification_outbox SET state='provider_accepted',provider_message_id=?,provider_accepted_at=datetime('now'),changed_at=datetime('now') WHERE notification_key=? AND attempt_token=? AND state='attempt_started'"
      ).bind(messageId,key,token).run();
      return result.meta?.changes === 1;
    },
  };
}
