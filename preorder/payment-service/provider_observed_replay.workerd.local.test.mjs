/**
 * Provider-observed shape replay in isolated native Workerd + D1.
 *
 * The properties, totals, consent and event ordering below were checked
 * against an actual Stripe TEST Payment Link charge/refund on Nov 17, 2026.
 * All provider IDs and purchaser fields are replaced with synthetic values.
 *
 * This suite re-SIGNS derived objects using a fake local webhook secret.
 * It is NOT original Stripe signature delivery and it makes NO cloud writes.
 * The disposable real TEST link was not allowlisted in the production worker.
 */
import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {createTestHarness} from "wrangler";
import {http,HttpResponse} from "msw";
import {setupServer} from "msw/node";

const seed=readFileSync(new URL("./schema.sql",import.meta.url),"utf8");
const key="whsec_FAKE_provider_shape_replay_local_only";
const checkout="cs_test_ProviderObservedSanitized";
const intent="pi_ProviderObservedSanitized";
const link="plink_ProviderObservedSanitized";
const price="price_ProviderObservedSanitized";
const refund="re_ProviderObservedSanitized";
const endpoint="https://example.invalid/webhooks/stripe";
const network=setupServer();

const workerd=createTestHarness({
 workers:[{
  config:{
   name:"groundwork-payment-observed-replay-local",
   main:fileURLToPath(new URL("./worker.local.entry.mjs",import.meta.url)),
   compatibility_date:"2026-11-13",workers_dev:false,routes:[],
   d1_databases:[{binding:"DB",database_name:"groundwork-observed-test-memory",
     database_id:"00000000-0000-0000-0000-000000000002"}]
  },
  vars:{
   __TEST_SCHEMA:seed,
   PAYMENTS_MODE:"sandbox",TERMS_APPROVED:"true",TERMS_VERSION:"prepurchase-v2026-11-17",
   MONTH_LINK_ID:link,MONTH_PRICE_ID:price,
   ANNUAL_LINK_ID:"plink_other_local",ANNUAL_PRICE_ID:"price_other_local",
   NOTIFICATION_SEND_MODE:"disabled",
   NOTIFICATION_OPERATOR_RELEASE:"false",
   NOTIFICATION_TEMPLATES_APPROVED:"false"
  },
  secrets:{
   STRIPE_WEBHOOK_SECRET:key,
   STRIPE_TEST_SECRET_KEY:"sk_test_FAKE_provider_observation_only"
  }
 }]
});
const lineItems=[{
 quantity:1,amount_subtotal:999,amount_total:1089,
 price:{id:price,currency:"usd",unit_amount:999,tax_behavior:"exclusive",recurring:null}
}];
const purchase={
 object:"checkout.session",
 id:checkout,
 livemode:false,
 mode:"payment",
 status:"complete",
 payment_status:"paid",
 payment_link:link,
 payment_intent:intent,
 customer:null,
 consent:{terms_of_service:"accepted"},
 consent_collection:{terms_of_service:"required"},
 currency:"usd",
 amount_subtotal:999,
 amount_total:1089,
 total_details:{amount_tax:90,amount_discount:0,amount_shipping:0}
};
const succeededRefund={
 object:"refund",id:refund,charge:"ch_ProviderObservedSanitized",
 payment_intent:intent,amount:1089,currency:"usd",status:"succeeded",livemode:false
};
function signed(eventId,type,object){
 const body=JSON.stringify({id:eventId,livemode:false,type,data:{object}});
 const timestamp=Math.floor(Date.now()/1000);
 const digest=createHmac("sha256",key).update(timestamp+"."+body).digest("hex");
 return {body,headers:{"stripe-signature":'t='+timestamp+',v1='+digest}};
}
async function deliver(event){
 return workerd.fetch(endpoint,{method:"POST",...event});
}
async function counts(){
 const response=await workerd.fetch("https://example.invalid/__test/counts");
 assert.equal(response.status,200);
 return response.json();
}
async function changes(){
 const response=await workerd.fetch("https://example.invalid/__test/changes");
 assert.equal(response.status,200);
 return response.json();
}

before(async()=>{
 network.listen({onUnhandledRequest:"error"});
 network.use(http.get("https://api.stripe.com/v1/checkout/sessions/:session/line_items",({params})=>{
  assert.equal(params.session,checkout);
  return HttpResponse.json({object:"list",has_more:false,data:lineItems});
 }));
 await workerd.listen();
 const created=await workerd.fetch("https://example.invalid/__test/seed",{method:"POST"});
 assert.equal(created.status,200,await created.text());
});
after(async()=>{await workerd.close();network.close();});

test("real-provider-field-shape replay: refund before purchase remains immutable separate journal, no access",async()=>{
 // A refund event can be delivered first; record it without pretending access
 // exists. Stripe refunded the real TEST charge, but this is synthetic local replay.
 const refundEvent=signed("evt_ObservedRefundFirst","refund.updated",succeededRefund);
 const refundResponse=await deliver(refundEvent);
 assert.equal(refundResponse.status,200,await refundResponse.text());
 assert.deepEqual(await counts(),{orders:0,events:0});
 const journal=await changes();
 assert.equal(journal.length,1);
 assert.deepEqual([
  journal[0].event_type,journal[0].amount_cents,journal[0].financial_status,
  journal[0].payment_intent_id
 ],["refund.updated",1089,"succeeded",intent]);

 // Fail-closed even though Stripe would've accepted other kinds of payments.
 for(const [label,details] of [
  ["unapproved_link",{payment_link:"plink_NOT_ALLOWLISTED"}],
  ["no_terms",{consent:{terms_of_service:null}}],
  ["wrong_tax",{amount_total:1079,total_details:{...purchase.total_details,amount_tax:80}}],
  ["live_mode",{livemode:true}]
 ]){
  const event=signed("evt_Invalid"+label,"checkout.session.completed",{...purchase,...details});
  const res=await deliver(event);
  assert.notEqual(res.status,200,label);
  assert.deepEqual(await counts(),{orders:0,events:0});
 }

 // Signed local facsimile of an otherwise provider-verified paid Checkout event.
 const first=signed("evt_ObservedPaid","checkout.session.completed",purchase);
 const response=await deliver(first);
 assert.equal(response.status,200,await response.text());
 assert.deepEqual(await counts(),{orders:1,events:1});
 const order=await (await workerd.fetch("https://example.invalid/__test/order")).json();
 assert.deepEqual(order,{status:"paid_unfulfilled",subtotal_cents:999,tax_cents:90,total_cents:1089});
 // Duplicate provider delivery must not duplicate the immutable order.
 assert.equal((await deliver(first)).status,200);
 assert.deepEqual(await counts(),{orders:1,events:1});
 assert.equal((await changes()).length,1);

 // The storage is original-payment evidence PLUS refund journal, NOT a member
 // eligibility decision. A later activation service MUST reconcile the refund
 // before allowing a paid clock to begin. No entitlement exists in this Worker.
});
