/**
 * Groundwork pre-purchase webhook receiver (SANDBOX ONLY, UNDEPLOYED).
 * Standalone Cloudflare Worker with its OWN D1 binding; never attach to the live app Worker.
 * No card details or customer email are stored. No membership entitlement is ever granted.
 */
const textEncoder = new TextEncoder();
const ageLimitSeconds = 300;

function safeHexEqual(a, b) {
  if (!/^[a-f0-9]{64}$/i.test(a || "") || !/^[a-f0-9]{64}$/i.test(b || "")) return false;
  let mismatch = 0;
  for (let i = 0; i < 64; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyStripeSignature(body, signatureHeader, secret, currentSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof body !== "string" || typeof signatureHeader !== "string" || !secret?.startsWith("whsec_")) return false;
  const parts = signatureHeader.split(",").map(s => s.trim());
  const stampPart = parts.find(s => /^t=\d+$/.test(s));
  if (!stampPart) return false;
  const timestamp = Number(stampPart.slice(2));
  if (!Number.isSafeInteger(timestamp) || Math.abs(currentSeconds - timestamp) > ageLimitSeconds) return false;
  const signatures = parts.filter(s => /^v1=[a-f\d]{64}$/i.test(s)).map(s => s.slice(3));
  if (signatures.length === 0) return false;
  const key = await crypto.subtle.importKey(
    "raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const digest = new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, textEncoder.encode(timestamp + "." + body)
  ));
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some(candidate => safeHexEqual(candidate, hex));
}

function expectedOffers(env) {
  return [
    { link: env.MONTH_LINK_ID, price: env.MONTH_PRICE_ID, term: "monthly", amount: 999, termsVersion: env.TERMS_VERSION },
    { link: env.ANNUAL_LINK_ID, price: env.ANNUAL_PRICE_ID, term: "annual", amount: 9600, termsVersion: env.TERMS_VERSION }
  ];
}

/** Validate Stripe session AND independently retrieved Stripe line items. */
export function verifyPaidPurchase(session, items, offers) {
  if (!session || session.object !== "checkout.session" || session.livemode !== false ||
      session.mode !== "payment" || session.payment_status !== "paid" ||
      !/^cs_test_[a-zA-Z0-9]+$/.test(session.id || "") ||
      !/^pi_[a-zA-Z0-9]+$/.test(session.payment_intent || "")) {
    throw new Error("Unverified or unpaid Stripe test session");
  }
  const offer = offers.find(o => o.link === session.payment_link && o.price && o.link && o.amount > 0);
  if (!offer) throw new Error("Unrecognized Stripe payment link");
  if (session.consent?.terms_of_service !== "accepted") {
    throw new Error("Stripe Checkout did not confirm terms-of-service acceptance");
  }
  if (!/^prepurchase-v\d{4}-\d{2}-\d{2}$/.test(offer.termsVersion || "")) {
    throw new Error("Approved terms version not configured");
  }
  if (session.currency !== "usd" || session.amount_subtotal !== offer.amount) {
    throw new Error("Unexpected currency or subtotal");
  }
  const details = session.total_details;
  if (!details || !Number.isInteger(details.amount_tax) || details.amount_tax < 0 ||
      details.amount_discount !== 0 || details.amount_shipping !== 0 ||
      session.amount_total !== offer.amount + details.amount_tax) {
    throw new Error("Unexpected payment amount or tax breakdown");
  }
  if (!Array.isArray(items) || items.length !== 1 || items[0].quantity !== 1 ||
      items[0].amount_subtotal !== offer.amount ||
      items[0].price?.id !== offer.price ||
      items[0].price?.currency !== "usd" ||
      items[0].price?.unit_amount !== offer.amount ||
      items[0].price?.tax_behavior !== "exclusive" ||
      items[0].price?.recurring != null) {
    throw new Error("Unexpected product, price, or quantity");
  }
  return {
    id: session.id,
    paymentIntent: session.payment_intent,
    customer: typeof session.customer === "string" ? session.customer : null,
    link: offer.link,
    price: offer.price,
    term: offer.term,
    termsVersion: offer.termsVersion,
    subtotal: offer.amount,
    tax: details.amount_tax,
    total: session.amount_total,
    currency: "usd",
    status: "paid_unfulfilled"
  };
}

const changeTypes = new Set([
  "refund.created", "refund.updated", "refund.failed",
  "charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed"
]);

export function verifyPaymentChange(event) {
  const object = event.data?.object;
  const refund = event.type.startsWith("refund.");
  const statuses = refund
    ? ["pending", "requires_action", "succeeded", "failed", "canceled"]
    : ["warning_needs_response", "warning_under_review", "warning_closed", "needs_response", "under_review", "won", "lost", "prevented"];
  const idPattern = refund ? /^re_[a-zA-Z0-9]+$/ : /^dp_[a-zA-Z0-9]+$/;
  if (!changeTypes.has(event.type) || !object ||
      object.object !== (refund ? "refund" : "dispute") || !idPattern.test(object.id || "") ||
      !Number.isSafeInteger(object.amount) || object.amount <= 0 || object.currency !== "usd" ||
      !statuses.includes(object.status) ||
      (event.type === "refund.failed" && object.status !== "failed") ||
      (object.livemode != null && object.livemode !== false)) {
    throw new Error("Invalid financial notification");
  }
  // Retain an unmatched charge/intent reference; do not discard an early event.
  const reference = (value, pattern) => {
    if (value == null) return null;
    if (typeof value !== "string" || !pattern.test(value)) throw new Error("Invalid payment reference");
    return value;
  };
  const charge = reference(object.charge, /^ch_[a-zA-Z0-9]+$/);
  const intent = reference(object.payment_intent, /^pi_[a-zA-Z0-9]+$/);
  if (!charge && !intent) throw new Error("Missing payment correlation");
  return [event.id, event.type, object.id, charge, intent, object.amount, object.currency, object.status];
}

async function recordPaymentChange(event, env) {
  const values = verifyPaymentChange(event);
  await env.DB.prepare(`INSERT INTO prepurchase_payment_changes(
    event_id,event_type,object_id,charge_id,payment_intent_id,amount_cents,currency,financial_status
  ) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING`).bind(...values).run();
  const row = await env.DB.prepare(`SELECT event_id,event_type,object_id,charge_id,
    payment_intent_id,amount_cents,currency,financial_status
    FROM prepurchase_payment_changes WHERE event_id = ?`).bind(event.id).first();
  const fields = ["event_id","event_type","object_id","charge_id","payment_intent_id","amount_cents","currency","financial_status"];
  if (!row || fields.some((field, i) => row[field] !== values[i])) throw new Error("Conflicting notification");
}

async function fetchStripeLineItems(env, sessionId) {
  const url = "https://api.stripe.com/v1/checkout/sessions/" +
    encodeURIComponent(sessionId) + "/line_items?limit=2";
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + env.STRIPE_TEST_SECRET_KEY }
  });
  if (!response.ok) throw new Error("Could not verify Stripe session line items");
  const payload = await response.json();
  if (payload.has_more || !Array.isArray(payload.data)) throw new Error("Stripe line items incomplete");
  return payload.data;
}

function ready(env) {
  const offers = expectedOffers(env);
  return env.PAYMENTS_MODE === "sandbox" && env.TERMS_APPROVED === "true" &&
    /^prepurchase-v\d{4}-\d{2}-\d{2}$/.test(env.TERMS_VERSION || "") && env.DB &&
    env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") &&
    env.STRIPE_TEST_SECRET_KEY?.startsWith("sk_test_") &&
    offers.every(o => typeof o.link === "string" && /^plink_/.test(o.link) &&
      typeof o.price === "string" && /^price_/.test(o.price));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/webhooks/stripe") return new Response("Not found", { status: 404 });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (!ready(env)) return new Response("Payment receiver not configured", { status: 503 });
    if (Number(request.headers.get("content-length") || 0) > 262144) {
      return new Response("Payload too large", { status: 413 });
    }
    const body = await request.text();
    if (textEncoder.encode(body).byteLength > 262144) return new Response("Payload too large", { status: 413 });
    const valid = await verifyStripeSignature(body, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return new Response("Invalid signature", { status: 400 });

    let event;
    try { event = JSON.parse(body); } catch { return new Response("Invalid event", { status: 400 }); }
    if (event.livemode !== false || typeof event.id !== "string" || !/^evt_[a-zA-Z0-9]+$/.test(event.id)) {
      return new Response("Unexpected Stripe environment", { status: 400 });
    }
    if (changeTypes.has(event.type)) {
      try {
        await recordPaymentChange(event, env);
        return new Response("Financial notification recorded; access unchanged", { status: 200 });
      } catch {
        return new Response("Financial notification verification failed", { status: 503 });
      }
    }
    const types = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
    if (!types.has(event.type)) return new Response("Event acknowledged", { status: 200 });

    const session = event.data?.object;
    if (session?.payment_status !== "paid") {
      // Delayed payment: wait for checkout.session.async_payment_succeeded.
      return new Response("Payment pending", { status: 200 });
    }

    try {
      const items = await fetchStripeLineItems(env, session.id);
      const order = verifyPaidPurchase(session, items, expectedOffers(env));
      const oldEvent = await env.DB.prepare(
        "SELECT event_id FROM stripe_processed_events WHERE event_id = ? LIMIT 1"
      ).bind(event.id).first();
      if (oldEvent) return new Response("Event already recorded", { status: 200 });

      // A second Stripe event can refer to the same paid session. Confirm it matches
      // the original immutable order; never hide conflicting records with INSERT OR IGNORE.
      const previous = await env.DB.prepare(
        `SELECT checkout_session_id, payment_intent_id, stripe_customer_id,
          payment_link_id, stripe_price_id, term, terms_version, subtotal_cents, tax_cents,
          total_cents, currency, status FROM prepurchase_orders
          WHERE checkout_session_id = ? OR payment_intent_id = ? LIMIT 1`
      ).bind(order.id, order.paymentIntent).first();
      if (previous) {
        const same = previous.checkout_session_id === order.id &&
          previous.payment_intent_id === order.paymentIntent &&
          previous.stripe_customer_id === order.customer &&
          previous.payment_link_id === order.link &&
          previous.stripe_price_id === order.price &&
          previous.term === order.term &&
          previous.terms_version === order.termsVersion &&
          previous.subtotal_cents === order.subtotal &&
          previous.tax_cents === order.tax &&
          previous.total_cents === order.total &&
          previous.currency === order.currency &&
          previous.status === "paid_unfulfilled";
        if (!same) throw new Error("Stripe purchase conflicts with stored order");
        await env.DB.prepare(
          "INSERT OR IGNORE INTO stripe_processed_events(event_id, event_type, checkout_session_id) VALUES (?, ?, ?)"
        ).bind(event.id, event.type, order.id).run();
        return new Response("Existing verified order; access remains inactive", { status: 200 });
      }
      // D1 batch is atomic. Duplicate races fail uniqueness and are retried by Stripe.
      // Retry sees the matching existing order; conflicting purchase data always fails.
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO stripe_processed_events(event_id, event_type, checkout_session_id) VALUES (?, ?, ?)"
        ).bind(event.id, event.type, order.id),
        env.DB.prepare(
          `INSERT INTO prepurchase_orders(
            checkout_session_id, payment_intent_id, stripe_customer_id, payment_link_id,
            stripe_price_id, term, terms_version, subtotal_cents, tax_cents, total_cents, currency, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(order.id, order.paymentIntent, order.customer, order.link, order.price,
          order.term, order.termsVersion, order.subtotal, order.tax, order.total, order.currency, order.status)
      ]);
      return new Response("Order recorded; access remains inactive", { status: 200 });
    } catch {
      // Never acknowledge failed validation/storage as success. Stripe retries 5xx.
      // No PII, raw bodies, tokens, or secrets are logged.
      return new Response("Payment verification failed", { status: 503 });
    }
  }
};

