import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { independentlyReviewFounderNotice } from "./notification_reviewer.draft.mjs";
if(!globalThis.crypto) globalThis.crypto=webcrypto;

const key="gwn1_"+"c".repeat(64);
const sessionId="cs_test_Founder001";
const intentId="pi_Founder001";
const email="founder@example.com";
const reviewSecret="review-test-secret-more-than-thirty-two";
const recipientSecret="recipient-test-secret-more-than-thirty-two";
const env=Object.freeze({
  FOUNDER_NOTIFICATION_REVIEW_ENABLED:"true",
  FOUNDER_NOTIFICATION_ADMIN_MODE:"sandbox_access_only",
  NOTIFICATION_SEND_MODE:"sandbox_founder_test",
  PAYMENTS_MODE:"sandbox",
  TERMS_APPROVED:"true",
  TERMS_VERSION:"prepurchase-v2026-11-15",
  STRIPE_TEST_SECRET_KEY:"sk_test_not_real",
  NOTIFICATION_RECIPIENT_HMAC_SECRET:recipientSecret,
  NOTIFICATION_REVIEW_SEAL_SECRET:reviewSecret,
  NOTIFICATION_TEST_RECIPIENT:email,
  FOUNDER_ACCESS_EMAIL:email,
  MONTH_LINK_ID:"plink_test_MonthOne",
  MONTH_PRICE_ID:"price_test_MonthOne",
  ANNUAL_LINK_ID:"plink_test_Annual",
  ANNUAL_PRICE_ID:"price_test_Annual",
});
async function hmac(secret,data) {
  const encoder=new TextEncoder();
  const k=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",k,encoder.encode(data))),
    x=>x.toString(16).padStart(2,"0")).join("");
}
const payment=()=>({
  object:"checkout.session",id:sessionId,livemode:false,mode:"payment",
  payment_status:"paid",payment_intent:intentId,
  payment_link:env.MONTH_LINK_ID,consent:{terms_of_service:"accepted"},
  currency:"usd",amount_subtotal:999,amount_total:1059,
  total_details:{amount_tax:60,amount_discount:0,amount_shipping:0},
  customer:"cus_Founder001",customer_email:null,
  customer_details:{email},
});
const items=()=>[{quantity:1,amount_subtotal:999,price:{
  id:env.MONTH_PRICE_ID,currency:"usd",unit_amount:999,
  tax_behavior:"exclusive",recurring:null,
}}];
const order=()=>({
  checkout_session_id:sessionId,payment_intent_id:intentId,
  stripe_customer_id:"cus_Founder001",payment_link_id:env.MONTH_LINK_ID,
  stripe_price_id:env.MONTH_PRICE_ID,term:"monthly",
  terms_version:env.TERMS_VERSION,subtotal_cents:999,tax_cents:60,
  total_cents:1059,currency:"usd",status:"paid_unfulfilled",
});
async function fixture(change={}) {
  const metrics={checkout:0,approve:0,proof:null};
  const notice={
    notification_key:key,checkout_session_id:sessionId,
    notice_type:"purchase_confirmation",notice_ref:"purchase",
    template_alias:"groundwork-prepurchase-confirmation-review",
    recipient_hmac:await hmac(recipientSecret,email),state:"review_pending",
    review_completed_at:null,
    ...change.notice,
  };
  const store={
    get:async()=>notice,
    getOrder:async()=>({...order(),...change.order}),
    getRefundEvent:async()=>change.refundEvent||null,
    async approve(proof) {
      metrics.approve++;
      metrics.proof=proof;
      return change.rejectClaim!==true;
    },
  };
  const provider={
    async checkout() {metrics.checkout++;return {...payment(),...change.payment};},
    async lineItems() {return items();},
    async refund() {return change.refund;},
  };
  const result=await independentlyReviewFounderNotice(
    {...env,...change.env},key,change.reviewer??email,{store,provider});
  return {result,metrics,notice};
}

test("disabled review modes and wrong verified reviewer never query provider",async()=>{
  for (const change of [
    {env:{FOUNDER_NOTIFICATION_REVIEW_ENABLED:"false"}},
    {env:{FOUNDER_NOTIFICATION_ADMIN_MODE:"disabled"}},
    {env:{PAYMENTS_MODE:"disabled"}},
    {env:{TERMS_APPROVED:"false"}},
    {env:{STRIPE_TEST_SECRET_KEY:"sk_live_not_permitted"}},
    {env:{NOTIFICATION_REVIEW_SEAL_SECRET:undefined}},
    {reviewer:"attacker@example.com"},
  ]) {
    const {result,metrics}=await fixture(change);
    assert.ok(["review_disabled","operator_identity_not_verified"].includes(result.status),result.status);
    assert.equal(metrics.checkout,0);
    assert.equal(metrics.approve,0);
  }
});

test("unreviewable notice states/types and payment mismatches never approve",async()=>{
  for (const change of [
    {notice:{state:"manual_review"}},
    {notice:{state:"review_verified",review_completed_at:"2026-11-15T00:00:00.000Z"}},
    {notice:{notice_type:"delivery_update"}},
    {notice:{notice_ref:"unexpected"}},
    {notice:{recipient_hmac:"e".repeat(64)}},
    {payment:{payment_status:"unpaid"}},
    {payment:{livemode:true}},
    {payment:{customer_details:{email:"attacker@example.com"}}},
    {payment:{customer_email:"conflict@example.com"}},
    {payment:{amount_total:1060}},
    {payment:{consent:{terms_of_service:"not_accepted"}}},
    {order:{total_cents:1060}},
  ]) {
    const {result,metrics}=await fixture(change);
    assert.notEqual(result.status,"review_verified",JSON.stringify(change));
    assert.equal(metrics.approve,0,JSON.stringify(change));
  }
});

test("sealed purchase evidence contains no plaintext email or credential and cannot be replayed",async()=>{
  const {result,metrics,notice}=await fixture();
  assert.equal(result.status,"review_verified");
  assert.equal(metrics.approve,1);
  const proof=metrics.proof;
  assert.equal(proof.notification_key,notice.notification_key);
  assert.equal(proof.recipient_hmac,notice.recipient_hmac);
  for(const k of ["reviewer_hmac","provider_proof_hmac","authorization_seal"]) {
    assert.match(proof[k],/^[a-f0-9]{64}$/);
  }
  assert.match(proof.reviewed_at,/^\d{4}-\d\d-\d\dT/);
  assert.ok(!JSON.stringify(proof).includes(email));
  assert.ok(!JSON.stringify(proof).includes(reviewSecret));
  assert.ok(!JSON.stringify(proof).includes(intentId));
});

test("refund approvals require corresponding matching verified Stripe event and refund",async()=>{
  const refund={object:"refund",livemode:false,id:"re_Founder001",amount:300,
    currency:"usd",payment_intent:intentId,created:1800000000,status:"pending"};
  const base={notice:{notice_type:"refund_initiated",notice_ref:refund.id,
    template_alias:"groundwork-refund-initiated-review"},
    refund,refundEvent:{event_type:"refund.created",amount_cents:300,currency:"usd"}};
  assert.equal((await fixture(base)).result.status,"review_verified");
  for (const change of [
    {refundEvent:null},{refundEvent:{event_type:"refund.updated",amount_cents:300,currency:"usd"}},
    {refund:{...refund,livemode:true}},{refund:{...refund,amount:1100}},
    {refund:{...refund,status:"failed"}},
  ]) {
    const metrics=await fixture({...base,...change});
    assert.notEqual(metrics.result.status,"review_verified");
    assert.equal(metrics.metrics.approve,0);
  }
});

test("conflicting atomic claim never returns approved",async()=>{
  const {result}=await fixture({rejectClaim:true});
  assert.equal(result.status,"review_conflict");
});
