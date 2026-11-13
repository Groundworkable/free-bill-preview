/**
 * Local Workerd + D1 contract test. No network calls to Cloudflare or Stripe.
 * Only uses a dedicated test-only Worker entrypoint and in-memory D1.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTestHarness } from "wrangler";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const schema=readFileSync(new URL("./schema.sql",import.meta.url),"utf8");
const secret="whsec_FAKE_TEST_SECRET_LOCAL_ONLY";
const sessionId="cs_test_ABC123local";
const paymentId="pi_ABC123local";
const endpoint="https://example.invalid/webhooks/stripe";
const network=setupServer();

const server=createTestHarness({
 workers:[{
   config:{
     name:"groundwork-payment-local-only",
     main:fileURLToPath(new URL("./worker.local.entry.mjs",import.meta.url)),
     compatibility_date:"2026-11-13",
     workers_dev:false,routes:[],
     d1_databases:[{binding:"DB",database_name:"groundwork-payment-test-memory",
       database_id:"00000000-0000-0000-0000-000000000001"}]
   },
   vars:{
     __TEST_SCHEMA:schema,
     PAYMENTS_MODE:"sandbox",TERMS_APPROVED:"true",TERMS_VERSION:"prepurchase-v2026-11-13",
     MONTH_LINK_ID:"plink_TEST_Month",
     MONTH_PRICE_ID:"price_TEST_Month",
     ANNUAL_LINK_ID:"plink_TEST_Annual",
     ANNUAL_PRICE_ID:"price_TEST_Annual"
   },
   secrets:{
     STRIPE_WEBHOOK_SECRET:secret,
     STRIPE_TEST_SECRET_KEY:"sk_test_FAKE_LOCAL_ONLY"
   }
 }]
});
const stripeUrl="https://api.stripe.com/v1/checkout/sessions/"+sessionId+"/line_items";
const lineItems=[{quantity:1,amount_subtotal:999,price:{
 id:"price_TEST_Month",currency:"usd",unit_amount:999,tax_behavior:"exclusive",recurring:null
}}];
function mockStripe(items=lineItems) {
 network.use(http.get("https://api.stripe.com/v1/checkout/sessions/:session/line_items",({request})=>{
   assert.equal(new URL(request.url).searchParams.get("limit"),"2");
   // Workerd-to-MSW header forwarding differs from direct Node fetch; the production
   // receiver constructs its Stripe Authorization header separately.
   return HttpResponse.json({data:items,has_more:false});
 }));
}
function makeSession(){
 return {object:"checkout.session",id:sessionId,livemode:false,mode:"payment",
   payment_status:"paid",payment_link:"plink_TEST_Month",payment_intent:paymentId,consent:{terms_of_service:"accepted"},
   currency:"usd",amount_subtotal:999,amount_total:1059,
   total_details:{amount_tax:60,amount_shipping:0,amount_discount:0}};
}
function makeEvent(id, type="checkout.session.completed", session=makeSession()){
 const body=JSON.stringify({id,livemode:false,type,data:{object:session}});
 const timestamp=Math.floor(Date.now()/1000);
 const digest=createHmac("sha256",secret).update(timestamp+"."+body).digest("hex");
 return {body,signature:`t=${timestamp},v1=${digest}`};
}
async function send(event){
 return server.fetch(endpoint,{method:"POST",headers:{"stripe-signature":event.signature},body:event.body});
}
async function counts(){
 const response=await server.fetch("https://example.invalid/__test/counts");
 assert.equal(response.status,200);
 return response.json();
}

before(async()=>{
 network.listen({onUnhandledRequest:"error"});
 await server.listen();
 const initialized=await server.fetch("https://example.invalid/__test/seed",{method:"POST"});
 assert.equal(initialized.status,200,await initialized.text());
});
after(async()=>{await server.close();network.close();});

test("rejects unsigned event without any D1 insert",async()=>{
 const response=await server.fetch(endpoint,{method:"POST",body:"{}"});
 assert.equal(response.status,400);
 assert.deepEqual(await counts(),{orders:0,events:0});
});
test("signed synthetic payment records one paid-unfulfilled D1 row",async()=>{
 mockStripe();
 const res=await send(makeEvent("evt_LocalOne"));
 assert.equal(res.status,200,await res.text());
 const order=await (await server.fetch("https://example.invalid/__test/order")).json();
 assert.equal(order.status,"paid_unfulfilled");
 assert.deepEqual([order.subtotal_cents,order.tax_cents,order.total_cents],[999,60,1059]);
 assert.deepEqual(await counts(),{orders:1,events:1});
});
test("replayed and secondary paid notifications keep one order",async()=>{
 mockStripe();
 assert.equal((await send(makeEvent("evt_LocalOne"))).status,200);
 assert.equal((await send(makeEvent("evt_LocalTwo","checkout.session.async_payment_succeeded"))).status,200);
 assert.deepEqual(await counts(),{orders:1,events:2});
});
test("incorrect Stripe line-item price rejects event without writing",async()=>{
 mockStripe([{...lineItems[0],price:{...lineItems[0].price,id:"price_NOT_APPROVED"}}]);
 const response=await send(makeEvent("evt_LocalBadPrice"));
 assert.equal(response.status,503);
 assert.deepEqual(await counts(),{orders:1,events:2});
});
