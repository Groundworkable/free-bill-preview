/**
 * Genuine local Workerd + D1 integration test. NO CLOUDFLARE ACCOUNT OR NETWORKED STRIPE.
 * All API Stripe calls intercepted with synthetic responses. No deployment possible.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createTestHarness } from "wrangler";

const path = new URL("./worker.mjs", import.meta.url).pathname;
const schema = readFileSync(new URL("./schema.sql", import.meta.url),"utf8");
const webhookSecret="whsec_DELIBERATELY_FAKE_LOCAL_TEST_ONLY";
const sessionId="cs_test_ABC123local";
const paymentId="pi_ABC123local";
const endpoint="https://test.invalid/webhooks/stripe";
const stripePath="https://api.stripe.com/v1/checkout/sessions/"+sessionId+"/line_items?limit=2";
const workerConfig={
  name:"groundwork-payment-local-only",
  main:path,
  compatibility_date:"2026-11-13",
  workers_dev:false,
  routes:[],
  d1_databases:[{binding:"DB",database_name:"groundwork-payment-test-memory",
    database_id:"00000000-0000-0000-0000-000000000001"}],
  vars:{
    PAYMENTS_MODE:"sandbox",
    MONTH_LINK_ID:"plink_TEST_Month",
    MONTH_PRICE_ID:"price_TEST_Month",
    ANNUAL_LINK_ID:"plink_TEST_Annual",
    ANNUAL_PRICE_ID:"price_TEST_Annual"
  }
};
const harness=createTestHarness({
 workers:[{config:workerConfig,secrets:{
  STRIPE_WEBHOOK_SECRET:webhookSecret,
  STRIPE_TEST_SECRET_KEY:"sk_test_DELIBERATELY_FAKE_LOCAL_ONLY"
 }}]
});
let env;
before(async()=>{
 await harness.listen();
 env=await harness.getWorker().getEnv();
 await env.DB.exec(schema);
});
after(async()=>{await harness.close();});

function stripeSession(){
 return {object:"checkout.session",id:sessionId,livemode:false,mode:"payment",
   payment_status:"paid",payment_link:"plink_TEST_Month",payment_intent:paymentId,
   currency:"usd",amount_subtotal:999,amount_total:1059,
   total_details:{amount_tax:60,amount_shipping:0,amount_discount:0}};
}
const lineItems={has_more:false,data:[{
 quantity:1,amount_subtotal:999,price:{
  id:"price_TEST_Month",unit_amount:999,currency:"usd",tax_behavior:"exclusive",recurring:null
 }}]};
function signedEvent(id,type="checkout.session.completed",session=stripeSession()){
 const event={id,livemode:false,type,data:{object:session}};
 const body=JSON.stringify(event);
 const at=Math.floor(Date.now()/1000);
 const hash=createHmac("sha256",webhookSecret).update(at+"."+body).digest("hex");
 return {body,signature:`t=${at},v1=${hash}`};
}
const originalFetch=globalThis.fetch;
function interceptStripe(items=lineItems){
 globalThis.fetch=async(input,init)=>{
  const url=typeof input==="string"?input:input?.url;
  if(url===stripePath) return new Response(JSON.stringify(items),{status:200,headers:{"content-type":"application/json"}});
  return originalFetch(input,init);
 };
}
async function send(event){
 return harness.fetch(endpoint,{method:"POST",headers:{"stripe-signature":event.signature},body:event.body});
}
async function counts(){
 return {
  orders:(await env.DB.prepare("SELECT count(*) as n FROM prepurchase_orders").first()).n,
  events:(await env.DB.prepare("SELECT count(*) as n FROM stripe_processed_events").first()).n
 };
}
test("local Worker rejects unsigned events and leaves real D1 empty",async()=>{
 const res=await harness.fetch(endpoint,{method:"POST",body:"{}"});
 assert.equal(res.status,400);
 assert.deepEqual(await counts(),{orders:0,events:0});
});
test("signed paid synthetic event writes one unfulfilled D1 order",async()=>{
 interceptStripe();
 try{
  const res=await send(signedEvent("evt_LocalOne"));
  assert.equal(res.status,200,await res.text());
  const row=await env.DB.prepare("SELECT status,subtotal_cents,tax_cents,total_cents FROM prepurchase_orders").first();
  assert.deepEqual([row.status,row.subtotal_cents,row.tax_cents,row.total_cents],
    ["paid_unfulfilled",999,60,1059]);
  assert.deepEqual(await counts(),{orders:1,events:1});
 }finally{globalThis.fetch=originalFetch;}
});
test("idempotency: same event and a distinct paid-success event retain one order",async()=>{
 interceptStripe();
 try{
  assert.equal((await send(signedEvent("evt_LocalOne"))).status,200);
  assert.equal((await send(signedEvent("evt_LocalTwo","checkout.session.async_payment_succeeded"))).status,200);
  assert.deepEqual(await counts(),{orders:1,events:2});
 }finally{globalThis.fetch=originalFetch;}
});
test("wrong Stripe price rejects payment, and no new rows are written",async()=>{
 const wrong={...lineItems,data:[{...lineItems.data[0],price:{...lineItems.data[0].price,id:"price_UNKNOWN"}}]};
 interceptStripe(wrong);
 try{
  const ev=signedEvent("evt_LocalThree","checkout.session.completed",
    {...stripeSession(),id:"cs_test_ABC123new",payment_intent:"pi_ABC123new"});
  // Different session ID requires a different matching mocked Stripe endpoint.
  const res=await send(ev);
  assert.equal(res.status,503);
  assert.deepEqual(await counts(),{orders:1,events:2});
 }finally{globalThis.fetch=originalFetch;}
});
