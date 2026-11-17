/**
 * Native Workerd + isolated in-memory D1 coverage of the opt-in Stripe TEST
 * webhook -> immutable paid order + review_pending outbox transaction.
 * No Cloudflare network writes, real Stripe/Resend calls, live routes or sends.
 */
import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {createTestHarness} from "wrangler";
import {http,HttpResponse} from "msw";
import {setupServer} from "msw/node";

const schema=[
  "schema.sql",
  "remote_d1_notification_ledger_additive_migration_2026-11-15.sql",
  "notification_review_evidence.draft.sql",
].map(name=>readFileSync(new URL(name,import.meta.url),"utf8")).join("\n");
const signingSecret="whsec_FAKE_ENQUEUE_LOCAL_ONLY";
const keySecret="test-only-HMAC-fingerprint-secret-at-least-32";
const recipient="founder-test@example.com";
const month="plink_TEST_Month";
const price="price_TEST_Month";
const endpoint="https://example.invalid/webhooks/stripe";
const network=setupServer();
const app=createTestHarness({workers:[{
  config:{
    name:"groundwork-enqueue-local-only",
    main:fileURLToPath(new URL("./notification_enqueue.workerd.local.entry.mjs",import.meta.url)),
    compatibility_date:"2026-11-15",workers_dev:false,routes:[],
    d1_databases:[{binding:"DB",database_name:"groundwork-enqueue-test-memory",
      database_id:"00000000-0000-0000-0000-000000000003"}],
  },
  vars:{
    __TEST_SCHEMA:schema,
    FOUNDER_NOTIFICATION_OUTBOX_MODE:"sandbox_founder_only",
    PAYMENTS_MODE:"sandbox",
    TERMS_APPROVED:"true",
    TERMS_VERSION:"prepurchase-v2026-11-16",
    MONTH_LINK_ID:month,MONTH_PRICE_ID:price,
    ANNUAL_LINK_ID:"plink_TEST_Annual",ANNUAL_PRICE_ID:"price_TEST_Annual",
    NOTIFICATION_SEND_MODE:"disabled",
    FOUNDER_NOTIFICATION_DISPATCH_ENABLED:"false",
    NOTIFICATION_OPERATOR_RELEASE:"false",
    FOUNDER_NOTIFICATION_REVIEW_ENABLED:"false",
    NOTIFICATION_TEST_RECIPIENT:recipient,
  },
  secrets:{
    STRIPE_WEBHOOK_SECRET:signingSecret,
    STRIPE_TEST_SECRET_KEY:"sk_test_FAKE_ENQUEUE_LOCAL_ONLY",
    NOTIFICATION_RECIPIENT_HMAC_SECRET:keySecret,
  },
}]});

function makeSession(id,email=recipient) {
  return {
    object:"checkout.session",id,livemode:false,mode:"payment",
    payment_status:"paid",payment_link:month,
    payment_intent:"pi_"+id.replace("cs_test_",""),
    consent:{terms_of_service:"accepted"},
    currency:"usd",amount_subtotal:999,amount_total:999,
    total_details:{amount_tax:0,amount_discount:0,amount_shipping:0},
    customer:"cus_FounderEnqueue",customer_details:{email},customer_email:null,
  };
}
const item={quantity:1,amount_subtotal:999,price:{
  id:price,currency:"usd",unit_amount:999,tax_behavior:"exclusive",recurring:null,
}};
function mockLineItems() {
  network.use(http.get("https://api.stripe.com/v1/checkout/sessions/:id/line_items",
    ({request})=>{
      assert.equal(new URL(request.url).searchParams.get("limit"),"2");
      return HttpResponse.json({object:"list",has_more:false,data:[item]});
    }));
}
function signed(eventId,session,type="checkout.session.completed"){
  const body=JSON.stringify({id:eventId,type,livemode:false,data:{object:session}});
  const ts=Math.floor(Date.now()/1000);
  const digest=createHmac("sha256",signingSecret).update(ts+"."+body).digest("hex");
  return {body,headers:{"stripe-signature":`t=${ts},v1=${digest}`}};
}
async function send(eventId,session,type){
  return app.fetch(endpoint,{method:"POST",...signed(eventId,session,type)});
}
async function state(){
  const res=await app.fetch("https://example.invalid/__test/state");
  assert.equal(res.status,200);
  return res.json();
}
function assertPending(row,sessionId){
  assert.equal(row.checkout_session_id,sessionId);
  assert.equal(row.notice_type,"purchase_confirmation");
  assert.equal(row.notice_ref,"purchase");
  assert.equal(row.state,"review_pending");
  assert.equal(row.review_completed_at,null);
  assert.equal(row.attempt_token,null);
  assert.equal(row.provider_message_id,null);
  assert.match(row.notification_key,/^gwn1_[a-f0-9]{64}$/);
  assert.match(row.recipient_hmac,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(row).includes(recipient));
}
before(async()=>{
  network.listen({onUnhandledRequest:"error"});
  mockLineItems();
  await app.listen();
  const res=await app.fetch("https://example.invalid/__test/seed",{method:"POST"});
  assert.equal(res.status,200,await res.text());
});
after(async()=>{await app.close();network.close();});

test("only signed, paid, consent-accepted founder TEST checkout can atomically enqueue pending",async()=>{
  const invalid=await app.fetch(endpoint,{method:"POST",body:"{}"});
  assert.equal(invalid.status,400);
  assert.deepEqual((await state()).counts,{events:0,orders:0,notices:0,journal:0,evidence:0});
  const s=makeSession("cs_test_Enqueue001");
  const accepted=await send("evt_Enqueue001",s);
  assert.equal(accepted.status,200,await accepted.text());
  const found=await state();
  assert.deepEqual(found.counts,{events:1,orders:1,notices:1,journal:1,evidence:0});
  assertPending(found.notices[0],s.id);
  assert.deepEqual(found.journal,[{old_state:null,new_state:"review_pending"}]);
  assert.deepEqual(found.orders,[{checkout_session_id:s.id,status:"paid_unfulfilled"}]);
});

test("exact event replay and distinct paid event for same checkout never duplicate outbox",async()=>{
  const s=makeSession("cs_test_Enqueue001");
  assert.equal((await send("evt_Enqueue001",s)).status,200);
  assert.equal((await send("evt_Enqueue001Secondary",s,"checkout.session.async_payment_succeeded")).status,200);
  const found=await state();
  assert.deepEqual(found.counts,{events:2,orders:1,notices:1,journal:1,evidence:0});
});

test("non-allowlisted founder identity fails before ANY remote-like D1 writes",async()=>{
  const s=makeSession("cs_test_Enqueue002","unknown@example.com");
  const res=await send("evt_Enqueue002",s);
  assert.equal(res.status,503,await res.text());
  const found=await state();
  assert.deepEqual(found.counts,{events:2,orders:1,notices:1,journal:1,evidence:0});
});

test("deliberate local-only outbox trigger failure rolls back event AND purchase",async()=>{
  const blocked=await app.fetch("https://example.invalid/__test/block-outbox",{method:"POST"});
  assert.equal(blocked.status,200,await blocked.text());
  const s=makeSession("cs_test_Rollback003");
  const response=await send("evt_Rollback003",s);
  assert.equal(response.status,503,await response.text());
  const found=await state();
  assert.deepEqual(found.counts,{events:2,orders:1,notices:1,journal:1,evidence:0});
});

test("no test-helper, status-review, dispatch or payment activation routes in actual receiver",async()=>{
  for(const url of ["/__test/notification/prepare","/founder/notifications/review",
      "/founder/notifications/dispatch","/founder/notifications/status"]){
    const response=await app.fetch("https://example.invalid"+url,{method:"POST"});
    assert.equal(response.status,404,url);
  }
  assert.equal((await state()).notices[0].state,"review_pending");
});
