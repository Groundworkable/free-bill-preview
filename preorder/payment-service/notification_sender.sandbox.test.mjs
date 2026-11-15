import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { dispatchFounderTestNotification } from "./notification_sender.sandbox.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const SESSION = "cs_test_Founder001";
const INTENT = "pi_Founder001";
const EMAIL = "founder-test@example.com";
const LINK = "plink_test_MonthOne";
const PRICE = "price_test_MonthOne";
const NOTICE_KEY = "gwn1_" + "a".repeat(64);
const TERMS = "prepurchase-v2026-11-15";
const HMAC_SECRET = "unit-test-key-0123456789-over-32-characters";
const TEMPLATE = "groundwork-prepurchase-confirmation-review";

const env = Object.freeze({
  NOTIFICATION_SEND_MODE: "sandbox_founder_test",
  NOTIFICATION_OPERATOR_RELEASE: "true",
  NOTIFICATION_TEMPLATES_APPROVED: "true",
  NOTIFICATION_TEST_RECIPIENT: EMAIL,
  NOTIFICATION_RECIPIENT_HMAC_SECRET: HMAC_SECRET,
  PAYMENTS_MODE: "sandbox",
  TERMS_APPROVED: "true",
  TERMS_VERSION: TERMS,
  STRIPE_TEST_SECRET_KEY: "sk_test_simulated_never_a_real_key",
  RESEND_API_KEY: "re_simulated_never_a_real_key",
  MONTH_LINK_ID: LINK,
  MONTH_PRICE_ID: PRICE,
  ANNUAL_LINK_ID: "plink_test_Annual",
  ANNUAL_PRICE_ID: "price_test_Annual",
});

async function hmac(email = EMAIL) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(email))),
    b => b.toString(16).padStart(2, "0")).join("");
}

function checkout(email = EMAIL) {
  return {
    object: "checkout.session", id: SESSION, livemode: false, mode: "payment",
    payment_status: "paid", payment_intent: INTENT, payment_link: LINK,
    consent: { terms_of_service: "accepted" },
    currency: "usd", amount_subtotal: 999, amount_total: 1059,
    total_details: { amount_tax: 60, amount_discount: 0, amount_shipping: 0 },
    customer: "cus_Founder001", customer_details: { email },
    customer_email: null,
  };
}
function lineItems() {
  return [{
    quantity: 1, amount_subtotal: 999,
    price: { id: PRICE, currency: "usd", unit_amount: 999, tax_behavior: "exclusive", recurring: null }
  }];
}
function order() {
  return {
    checkout_session_id: SESSION, payment_intent_id: INTENT, stripe_customer_id: "cus_Founder001",
    payment_link_id: LINK, stripe_price_id: PRICE, term: "monthly",
    terms_version: TERMS, subtotal_cents: 999, tax_cents: 60, total_cents: 1059,
    currency: "usd", status: "paid_unfulfilled"
  };
}

async function scenario(options = {}) {
  const metrics = { send: 0, claim: 0, authorized: 0, checked: 0, accepted: 0 };
  const stored = {
    notification_key: NOTICE_KEY, checkout_session_id: SESSION,
    state: "review_verified", notice_type: "purchase_confirmation",
    notice_ref: "purchase", recipient_hmac: await hmac(),
    template_alias: TEMPLATE,
    ...options.row,
  };
  let claimed = false;
  const adapters = {
    store: {
      async get() { return stored; },
      async getOrder() { return { ...order(), ...options.order }; },
      async getRefundEvent() { return null; },
      async claim(key, token) {
        metrics.claim++;
        if (claimed) return false;
        claimed = true;
        return options.claimFails ? false : true;
      },
      async providerAccepted() { metrics.accepted++;return !options.ledgerRecordFails; },
    },
    provider: {
      async checkout() {metrics.checked++; return { ...checkout(), ...options.session };},
      async lineItems() {return lineItems();},
      async refund() {throw Error("Not expected in purchase test");}
    },
    transport: {
      async templateIsPublished() {return options.templatePublished !== false;},
      async send(payload) {
        metrics.send++;
        if (options.sendTimesOut) throw Error("Uncertain transport");
        if (options.invalidReceipt) return {id:null};
        metrics.payload = payload;
        return { id: "01a1de7c-664c-7a96-9e4c-f8a9589c1ee1" };
      },
    },
    approval: {
      async isAuthorized() {metrics.authorized++;return options.approved !== false;},
      async deliveryCopy() {throw Error("Not expected in purchase test");},
    },
  };
  return { result: await dispatchFounderTestNotification(
    { ...env, ...options.env }, NOTICE_KEY, adapters), metrics };
}

test("default disabled and missing approval block all external interactions", async () => {
  for (const override of [
    {NOTIFICATION_SEND_MODE:"disabled"},
    {NOTIFICATION_OPERATOR_RELEASE:"false"},
    {NOTIFICATION_TEMPLATES_APPROVED:"false"},
    {PAYMENTS_MODE:"disabled"},
    {TERMS_APPROVED:"false"},
    {TERMS_VERSION:"UNAPPROVED"},
    {RESEND_API_KEY:undefined},
    {NOTIFICATION_TEST_RECIPIENT:undefined},
    {NOTIFICATION_RECIPIENT_HMAC_SECRET:undefined},
    {STRIPE_TEST_SECRET_KEY:"sk_live_bad"},
  ]) {
    const {result, metrics} = await scenario({env:override});
    assert.equal(result.status,"disabled");
    assert.equal(metrics.claim,0);
    assert.equal(metrics.send,0);
    assert.equal(metrics.checked,0);
  }
  const noAdapter = await dispatchFounderTestNotification(env, NOTICE_KEY);
  assert.equal(noAdapter.status,"missing_trusted_adapter");
});

test("approved but unpublished or not operator-authorized cannot send", async () => {
  for (const change of [{approved:false},{templatePublished:false}]) {
    const {result,metrics}=await scenario(change);
    assert.notEqual(result.status,"provider_accepted_await_delivery_evidence");
    assert.equal(metrics.send,0);
    assert.equal(metrics.claim,0);
  }
});

test("recipient and transaction mismatches fail before claim or send", async () => {
  for (const change of [
    {session: {customer_details: {email:"different@example.com"}}},
    {session: {customer_email:"conflict@example.com"}},
    {session: {payment_status:"unpaid"}},
    {session: {livemode:true}},
    {session: {consent: {terms_of_service:"not_accepted"}}},
    {session: {amount_total:1060}},
    {order: {total_cents:1060}},
    {row: {recipient_hmac:"a".repeat(64)}},
  ]) {
    const {result,metrics}=await scenario(change);
    assert.equal(result.status,"evidence_failed");
    assert.equal(metrics.claim,0);
    assert.equal(metrics.send,0);
  }
});

test("single mock send claims before transport, preserves idempotency and no entitlement", async () => {
  const {result,metrics}=await scenario();
  assert.equal(result.status,"provider_accepted_await_delivery_evidence");
  assert.equal(metrics.claim,1);
  assert.equal(metrics.send,1);
  assert.equal(metrics.accepted,1);
  assert.equal(metrics.payload.to,EMAIL);
  assert.equal(metrics.payload.templateAlias,TEMPLATE);
  assert.equal(metrics.payload.idempotencyKey,NOTICE_KEY);
  assert.equal(metrics.payload.variables.TAX,"$0.60");
  assert.equal(metrics.payload.variables.TOTAL_PAID,"$10.59");
  assert.equal(metrics.payload.variables.ACCESS_SCHEDULE.includes("February 2027"),true);
  assert.equal("entitlement" in metrics.payload,false);
});

test("failed atomic claim and ambiguous provider results never request another send", async () => {
  for(const change of [{claimFails:true},{sendTimesOut:true},{invalidReceipt:true},
                       {ledgerRecordFails:true}]) {
    const {result,metrics}=await scenario(change);
    assert.equal(metrics.claim,1);
    assert.ok(metrics.send<=1);
    assert.ok(result.status!=="provider_accepted_await_delivery_evidence");
  }
});

test("sender rejects wrong notification key and a non-reviewed record", async () => {
  assert.equal((await dispatchFounderTestNotification(env,"gwn1_invalid")).status,"invalid_reference");
  const {result,metrics}=await scenario({row:{state:"attempt_started"}});
  assert.equal(result.status,"not_reviewed_or_inconsistent");
  assert.equal(metrics.claim,0);
  assert.equal(metrics.send,0);
});
