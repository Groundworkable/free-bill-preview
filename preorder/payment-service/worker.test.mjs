import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker, { verifyStripeSignature, verifyPaidPurchase } from "./worker.mjs";

const key = "whsec_groundwork_sandbox_fake_test_key";
const now = Math.floor(Date.now()/1000);
function sign(body, when=now){
  const value=createHmac("sha256",key).update(when+"."+body).digest("hex");
  return `t=${when},v1=${value}`;
}
const offers=[
  {link:"plink_test_month",price:"price_test_month",term:"monthly",amount:999},
  {link:"plink_test_annual",price:"price_test_annual",term:"annual",amount:9600}
];
function fixture(total=999,tax=0){
  return {
    object:"checkout.session",id:"cs_test_Abc123",livemode:false,
    mode:"payment",payment_status:"paid",payment_link:"plink_test_month",
    payment_intent:"pi_Abc123",currency:"usd",amount_subtotal:999,
    amount_total:total,total_details:{amount_tax:tax,amount_shipping:0,amount_discount:0}
  };
}
const items=[{quantity:1,amount_subtotal:999,price:{id:"price_test_month",currency:"usd",unit_amount:999,tax_behavior:"exclusive",recurring:null}}];

test("signed webhook timestamps and signature are enforced",async()=>{
  const body=JSON.stringify({id:"evt_testA"});
  assert.equal(await verifyStripeSignature(body,sign(body),key,now),true);
  assert.equal(await verifyStripeSignature(body+" ",sign(body),key,now),false);
  assert.equal(await verifyStripeSignature(body,sign(body,now-601),key,now),false);
  assert.equal(await verifyStripeSignature(body,"t=123,v1=garbage",key,now),false);
});

test("one-time paid sandbox purchase is verified and never activated",()=>{
  const result=verifyPaidPurchase(fixture(1059,60),items,offers);
  assert.equal(result.status,"paid_unfulfilled");
  assert.equal(result.total,1059);
  assert.equal(result.tax,60);
  assert.equal(result.term,"monthly");
});

test("rejects live, unapproved, discounted, malformed, or unpaid purchase",()=>{
  const reject=(s,it=items)=>assert.throws(()=>verifyPaidPurchase(s,it,offers));
  reject({...fixture(),livemode:true});
  reject({...fixture(),payment_status:"unpaid"});
  reject({...fixture(),payment_link:"plink_different"});
  reject({...fixture(),amount_subtotal:900});
  reject({...fixture(999,50)});
  reject({...fixture(),total_details:{amount_tax:0,amount_discount:1,amount_shipping:0}});
  reject(fixture(),[{...items[0],quantity:2}]);
  reject(fixture(),[{...items[0],price:{...items[0].price,recurring:{interval:"month"}}}]);
});

function fakeDb(){
 const writes=[];
 const db={
   prepare(query){return {
     bind(...values){return {
       first:async()=>null,
       run:async()=>({success:true}),
       query,
       values
     }}
   }},
   async batch(statements){writes.push(statements);return [];}
 };
 return {db,writes};
}
const originalFetch=globalThis.fetch;
async function call(event,options={}){
  const {db,writes}=fakeDb();
  const env={PAYMENTS_MODE:"sandbox",DB:db,
    STRIPE_WEBHOOK_SECRET:key,STRIPE_TEST_SECRET_KEY:"sk_test_fake",
    MONTH_LINK_ID:"plink_test_month",MONTH_PRICE_ID:"price_test_month",
    ANNUAL_LINK_ID:"plink_test_annual",ANNUAL_PRICE_ID:"price_test_annual"
  };
  const body=JSON.stringify(event);
  const request=new Request("https://test.example/webhooks/stripe",{
    method:"POST",headers:{"stripe-signature":sign(body)},body
  });
  globalThis.fetch=async()=>new Response(JSON.stringify({data:options.items??items,has_more:false}),{status:200});
  try{
    const response=await worker.fetch(request,env);
    return {response,writes};
  } finally{globalThis.fetch=originalFetch;}
}
test("webhook receiver records paid, unfulfilled only from verified event",async()=>{
 const event={id:"evt_Abc123",livemode:false,type:"checkout.session.completed",data:{object:fixture()}};
 const {response,writes}=await call(event);
 assert.equal(response.status,200);
 assert.equal(writes.length,1);
 assert.equal(writes[0].length,2);
 assert.ok(writes[0][1].values.includes("paid_unfulfilled"));
});
test("pending payment, live events and invalid price do not create orders",async()=>{
 const base={id:"evt_Abc123",livemode:false,type:"checkout.session.completed",data:{object:fixture()}};
 const pending=await call({...base,data:{object:{...fixture(),payment_status:"unpaid"}}});
 assert.equal(pending.response.status,200);
 assert.equal(pending.writes.length,0);
 const live=await call({...base,livemode:true});
 assert.equal(live.response.status,400);
 const invalid=await call(base,{items:[{...items[0],price:{...items[0].price,id:"price_other"}}]});
 assert.equal(invalid.response.status,503);
 assert.equal(invalid.writes.length,0);
});
test("unknown routes and unsigned requests are rejected",async()=>{
 const res=await worker.fetch(new Request("https://test.example/nope"),{});
 assert.equal(res.status,404);
 const bad=await worker.fetch(new Request("https://test.example/webhooks/stripe",{method:"POST",body:"{}"}),{
  PAYMENTS_MODE:"sandbox",DB:{},STRIPE_WEBHOOK_SECRET:key,STRIPE_TEST_SECRET_KEY:"sk_test_fake",
  MONTH_LINK_ID:"plink_a",MONTH_PRICE_ID:"price_a",ANNUAL_LINK_ID:"plink_b",ANNUAL_PRICE_ID:"price_b"
 });
 assert.equal(bad.status,400);
});

test("duplicate paid sessions are acknowledged without creating a second order",async()=>{
 const row={
   checkout_session_id:"cs_test_Abc123",
   payment_intent_id:"pi_Abc123",
   stripe_customer_id:null,
   payment_link_id:"plink_test_month",
   stripe_price_id:"price_test_month",
   term:"monthly",subtotal_cents:999,tax_cents:0,total_cents:999,
   currency:"usd",status:"paid_unfulfilled"
 };
 const statements=[];
 const db={prepare(query){return {bind(...values){return {
   first:async()=>query.includes("FROM prepurchase_orders")?row:null,
   run:async()=>{statements.push({query,values});return {success:true}}
 }}}}};
 const env={PAYMENTS_MODE:"sandbox",DB:db,
   STRIPE_WEBHOOK_SECRET:key,STRIPE_TEST_SECRET_KEY:"sk_test_fake",
   MONTH_LINK_ID:"plink_test_month",MONTH_PRICE_ID:"price_test_month",
   ANNUAL_LINK_ID:"plink_test_annual",ANNUAL_PRICE_ID:"price_test_annual"};
 const event={id:"evt_SecondAbc",livemode:false,type:"checkout.session.async_payment_succeeded",data:{object:fixture()}};
 const body=JSON.stringify(event);
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({data:items,has_more:false}),{status:200});
 try{
   const req=new Request("https://test.example/webhooks/stripe",{method:"POST",headers:{"stripe-signature":sign(body)},body});
   const resp=await worker.fetch(req,env);
   assert.equal(resp.status,200);
   assert.match(await resp.text(),/Existing verified order/);
   assert.equal(statements.length,1);
   assert.ok(statements[0].query.includes("stripe_processed_events"));
 }finally{globalThis.fetch=original;}
});

test("conflicting duplicate sessions return 503 and record nothing",async()=>{
 const db={prepare(query){return {bind(){return {
  first:async()=>query.includes("FROM prepurchase_orders")?{
   checkout_session_id:"cs_test_Abc123", payment_intent_id:"pi_WRONG",
   stripe_customer_id:null, payment_link_id:"plink_test_month",stripe_price_id:"price_test_month",
   term:"monthly",subtotal_cents:999,tax_cents:0,total_cents:999,
   currency:"usd",status:"paid_unfulfilled"
  }:null,
  run:async()=>{throw Error("Conflict must not write")}
 }}}}};
 const env={PAYMENTS_MODE:"sandbox",DB:db,STRIPE_WEBHOOK_SECRET:key,
   STRIPE_TEST_SECRET_KEY:"sk_test_fake",MONTH_LINK_ID:"plink_test_month",
   MONTH_PRICE_ID:"price_test_month",ANNUAL_LINK_ID:"plink_test_annual",
   ANNUAL_PRICE_ID:"price_test_annual"};
 const event={id:"evt_Conflict",livemode:false,type:"checkout.session.completed",data:{object:fixture()}};
 const body=JSON.stringify(event);
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({data:items,has_more:false}),{status:200});
 try{
   const req=new Request("https://test.example/webhooks/stripe",{method:"POST",headers:{"stripe-signature":sign(body)},body});
   const resp=await worker.fetch(req,env);
   assert.equal(resp.status,503);
   assert.match(await resp.text(),/verification failed/);
 }finally{globalThis.fetch=original;}
});
