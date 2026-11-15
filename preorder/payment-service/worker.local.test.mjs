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

const schema=readFileSync(new URL("./schema.sql",import.meta.url),"utf8") + "\n" +
  readFileSync(new URL("./notification_ledger.draft.sql",import.meta.url),"utf8");
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
     ANNUAL_PRICE_ID:"price_TEST_Annual",
     NOTIFICATION_SEND_MODE:"sandbox_founder_test",
     NOTIFICATION_OPERATOR_RELEASE:"true",
     NOTIFICATION_TEMPLATES_APPROVED:"true",
     NOTIFICATION_TEST_RECIPIENT:"founder-test@example.com",
     __TEST_OPERATOR_AUTHORIZED:"true"
   },
   secrets:{
     STRIPE_WEBHOOK_SECRET:secret,
     STRIPE_TEST_SECRET_KEY:"sk_test_FAKE_LOCAL_ONLY",
     RESEND_API_KEY:"re_FAKE_LOCAL_ONLY",
     NOTIFICATION_RECIPIENT_HMAC_SECRET:"synthetic-secret-minimum-32-chars-test"
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
   total_details:{amount_tax:60,amount_shipping:0,amount_discount:0},
   customer:"cus_LocalSynthetic",customer_details:{email:"founder-test@example.com"},customer_email:null};
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



test("financial notifications use real D1 uniqueness without modifying paid orders",async()=>{
 const change=(id,type,status,amount=300)=>makeEvent(id,type,{
   object:type.startsWith("refund.")?"refund":"dispute",
   id:type.startsWith("refund.")?"re_LocalRefund":"dp_LocalDispute",
   charge:"ch_LocalCharge",payment_intent:paymentId,amount,currency:"usd",status
 });
 const success=change("evt_RefundDone","refund.updated","succeeded");
 assert.equal((await send(success)).status,200);
 assert.equal((await send(success)).status,200);
 assert.equal((await send(change("evt_RefundPending","refund.created","pending"))).status,200);
 assert.equal((await send(change("evt_RefundFailed","refund.failed","failed"))).status,200);
 assert.equal((await send(change("evt_Dispute","charge.dispute.created","needs_response"))).status,200);
 // A conflicting replay must not overwrite the original journal entry.
 assert.equal((await send(change("evt_RefundDone","refund.updated","succeeded",500))).status,503);
 const rows=await (await server.fetch("https://example.invalid/__test/changes")).json();
 assert.equal(rows.length,4);
 assert.equal(rows.find(r=>r.event_id==="evt_RefundDone").amount_cents,300);
 assert.equal(rows.find(r=>r.event_id==="evt_RefundPending").financial_status,"pending");
 const order=await (await server.fetch("https://example.invalid/__test/order")).json();
 assert.deepEqual(order,{status:"paid_unfulfilled",subtotal_cents:999,tax_cents:60,total_cents:1059});
 assert.deepEqual(await counts(),{orders:1,events:2});
});

test("local D1 journal immutability triggers reject UPDATE and DELETE", async()=>{
  // This local-only probe is never exposed by the deployable Worker.
  const response=await server.fetch("https://example.invalid/__test/journal-immutability");
  const body=await response.text();
  assert.equal(response.status,200,body);
  assert.deepEqual(JSON.parse(body),{
    updateBlocked:true,deleteBlocked:true,rowUnchanged:true
  });
  assert.deepEqual(await counts(),{orders:1,events:2});
});


test("local D1 original purchase evidence rejects UPDATE and DELETE", async()=>{
  const response=await server.fetch("https://example.invalid/__test/order-immutability");
  const body=await response.text();
  assert.equal(response.status,200,body);
  assert.deepEqual(JSON.parse(body),{
    updateBlocked:true,deleteBlocked:true,orderUnchanged:true
  });
  const order=await (await server.fetch("https://example.invalid/__test/order")).json();
  assert.deepEqual(order,{status:"paid_unfulfilled",subtotal_cents:999,tax_cents:60,total_cents:1059});
});


test("signed checkout to local D1 to reviewed notification to mocked Resend; repeat never sends",async()=>{
  const KEY = "gwn1_" + "c".repeat(64);
  mockStripe();
  const calls = {stripeCheckout:0, stripeItems:0, resendPost:0, resendGet:0};
  network.use(
    http.get("https://api.stripe.com/v1/checkout/sessions/:session",({params})=>{
      calls.stripeCheckout++;
      assert.equal(params.session,sessionId);
      return HttpResponse.json(makeSession());
    }),
    http.get("https://api.stripe.com/v1/checkout/sessions/:session/line_items",()=>{
      calls.stripeItems++;
      return HttpResponse.json({object:"list",data:lineItems,has_more:false});
    }),
    http.get("https://api.resend.com/templates/:alias",({params})=>{
      calls.resendGet++;
      assert.equal(params.alias,"groundwork-prepurchase-confirmation-review");
      return HttpResponse.json({
        object:"template",alias:params.alias,status:"published",has_unpublished_versions:false
      });
    }),
    http.post("https://api.resend.com/emails",async({request})=>{
      calls.resendPost++;
      assert.equal(request.headers.get("Idempotency-Key"),KEY);
      assert.equal(request.headers.get("Authorization"),"Bearer re_FAKE_LOCAL_ONLY");
      const payload=await request.json();
      assert.deepEqual(payload.to,["founder-test@example.com"]);
      assert.equal(payload.template.id,"groundwork-prepurchase-confirmation-review");
      assert.equal(payload.template.variables.ORDER_REFERENCE,sessionId);
      assert.equal(payload.template.variables.TOTAL_PAID,"$10.59");
      return HttpResponse.json({id:"01a1de7c-664c-7a96-9e4c-f8a9589c1ee1"});
    })
  );
  const duplicateCheckout=await send(makeEvent("evt_LocalNotifyDuplicate"));
  assert.equal(duplicateCheckout.status,200,await duplicateCheckout.text());
  assert.deepEqual(await counts(),{orders:1,events:3});
  const prepare=await server.fetch("https://example.invalid/__test/notification/prepare",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({notificationKey:KEY,kind:"purchase_confirmation",noticeRef:"purchase"})
  });
  assert.equal(prepare.status,200,await prepare.text());
  const dispatch=async()=>server.fetch("https://example.invalid/__test/notification/dispatch",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({notificationKey:KEY})
  });
  const first=await dispatch();
  assert.equal(first.status,200);
  const firstResult=await first.json();
  assert.equal(firstResult.status,"provider_accepted_await_delivery_evidence",JSON.stringify(firstResult));
  const again=await dispatch();
  assert.equal(again.status,200);
  const againResult=await again.json();
  assert.equal(againResult.status,"not_reviewed_or_inconsistent",JSON.stringify(againResult));
  assert.equal(calls.resendPost,1,"exactly one mocked provider send");
  assert.equal(calls.stripeCheckout,1,"repeat should not read provider");
  const state=await (await server.fetch("https://example.invalid/__test/notification/outbox")).json();
  const row=state.rows.find(x=>x.notification_key===KEY);
  assert.equal(row.state,"provider_accepted");
  assert.equal(row.attempt_token,KEY);
  assert.equal(row.provider_message_id,"01a1de7c-664c-7a96-9e4c-f8a9589c1ee1");
  assert.deepEqual(state.journal.filter(x=>x.notification_key===KEY).map(x=>x.new_state),
    ["review_pending","review_verified","attempt_started","provider_accepted"]);
  assert.equal((await (await server.fetch("https://example.invalid/__test/order")).json()).status,"paid_unfulfilled");
});

test("signed refund journal to separately reviewed notice to mocked Resend, no automatic refund email",async()=>{
  const KEY = "gwn1_" + "d".repeat(64);
  const refundId="re_LocalRefund";
  const signedRefund=makeEvent("evt_LocalNotificationRefund","refund.created",{
    object:"refund",id:refundId,charge:"ch_LocalCharge",payment_intent:paymentId,
    amount:300,currency:"usd",status:"pending",livemode:false
  });
  assert.equal((await send(signedRefund)).status,200);
  const existing=(await (await server.fetch("https://example.invalid/__test/changes")).json());
  assert.ok(existing.some(x=>x.event_id==="evt_LocalNotificationRefund" && x.financial_status==="pending"));
  const before=(await (await server.fetch("https://example.invalid/__test/notification/outbox")).json());
  assert.equal(before.rows.some(x=>x.notice_type==="refund_initiated"),false,
    "Signed financial events must not automatically send notifications");
  let sent=0;
  mockStripe();
  network.use(
    http.get("https://api.stripe.com/v1/checkout/sessions/:session",()=>
      HttpResponse.json(makeSession())),
    http.get("https://api.stripe.com/v1/checkout/sessions/:session/line_items",()=>
      HttpResponse.json({object:"list",has_more:false,data:lineItems})),
    http.get("https://api.stripe.com/v1/refunds/:id",({params})=>{
      assert.equal(params.id,refundId);
      return HttpResponse.json({
        object:"refund",id:refundId,livemode:false,amount:300,currency:"usd",
        payment_intent:paymentId,status:"pending",created:1794650000
      });
    }),
    http.get("https://api.resend.com/templates/:alias",({params})=>{
      assert.equal(params.alias,"groundwork-refund-initiated-review");
      return HttpResponse.json({object:"template",alias:params.alias,
        status:"published",has_unpublished_versions:false});
    }),
    http.post("https://api.resend.com/emails",async({request})=>{
      sent++;
      assert.equal(request.headers.get("Idempotency-Key"),KEY);
      const body=await request.json();
      assert.deepEqual(body.to,["founder-test@example.com"]);
      assert.equal(body.template.id,"groundwork-refund-initiated-review");
      assert.equal(body.template.variables.REFUND_REFERENCE,refundId);
      assert.equal(body.template.variables.REFUND_AMOUNT,"$3.00");
      return HttpResponse.json({id:"01a1de7c-664c-7a96-9e4c-f8a9589c1ee2"});
    })
  );
  const post=async(path,payload)=>server.fetch("https://example.invalid"+path,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)
  });
  const prepared=await post("/__test/notification/prepare",{
    notificationKey:KEY,kind:"refund_initiated",noticeRef:refundId
  });
  assert.equal(prepared.status,200,await prepared.text());
  const attempted=await post("/__test/notification/dispatch",{notificationKey:KEY});
  const attemptResult=await attempted.json();
  assert.equal(attemptResult.status,"provider_accepted_await_delivery_evidence",JSON.stringify(attemptResult));
  const repeatResult=await (await post("/__test/notification/dispatch",{notificationKey:KEY})).json();
  assert.equal(repeatResult.status,"not_reviewed_or_inconsistent",JSON.stringify(repeatResult));
  assert.equal(sent,1);
  const after=await (await server.fetch("https://example.invalid/__test/notification/outbox")).json();
  const record=after.rows.find(x=>x.notification_key===KEY);
  assert.equal(record.state,"provider_accepted");
  assert.deepEqual(after.journal.filter(x=>x.notification_key===KEY).map(x=>x.new_state),
    ["review_pending","review_verified","attempt_started","provider_accepted"]);
  const order=await (await server.fetch("https://example.invalid/__test/order")).json();
  assert.equal(order.status,"paid_unfulfilled");
});
