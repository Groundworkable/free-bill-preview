import test from "node:test";
import assert from "node:assert/strict";
import { stripeTestReadAdapter, resendFounderTestTransport } from "./notification_provider_adapters.sandbox.mjs";

const sessionId = "cs_test_Synthetic001";
const refundId = "re_Synthetic001";
const alias = "groundwork-prepurchase-confirmation-review";
const key = "gwn1_" + "b".repeat(64);
const email = "founder@example.com";
const env = {
  NOTIFICATION_SEND_MODE:"sandbox_founder_test",
  NOTIFICATION_OPERATOR_RELEASE:"true", NOTIFICATION_TEMPLATES_APPROVED:"true",
  NOTIFICATION_TEST_RECIPIENT:email, PAYMENTS_MODE:"sandbox", TERMS_APPROVED:"true",
  STRIPE_TEST_SECRET_KEY:"sk_test_fake_never_real", RESEND_API_KEY:"re_fake_never_real",
};
const respond = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {status, headers:{"Content-Type":"application/json"}});
const checkout = {object:"checkout.session",id:sessionId,livemode:false,mode:"payment"};
const lineItems = {object:"list",has_more:false,data:[{id:"li_synthetic"}]};
const refund = {object:"refund",id:refundId,livemode:false,status:"pending"};

test("Stripe GETs require test-only flags and strict path IDs", async ()=>{
  let count=0;
  const fake = async (url,opts)=>{
    count++; assert.equal(opts.method,"GET");
    assert.equal(opts.headers.Authorization,"Bearer sk_test_fake_never_real");
    assert.ok(url.startsWith("https://api.stripe.com/v1/"));
    if(url.includes("line_items"))return respond(lineItems);
    if(url.includes("refunds"))return respond(refund);
    return respond(checkout);
  };
  const provider=stripeTestReadAdapter(env,fake);
  assert.equal((await provider.checkout(sessionId)).id,sessionId);
  assert.equal((await provider.lineItems(sessionId)).length,1);
  assert.equal((await provider.refund(refundId)).id,refundId);
  assert.equal(count,3);
  await assert.rejects(provider.checkout("cs_live_123"));
  await assert.rejects(provider.refund("../refunds/re_bad"));
  assert.equal(count,3);
  await assert.rejects(stripeTestReadAdapter({...env,PAYMENTS_MODE:"disabled"},fake).checkout(sessionId));
  assert.equal(count,3);
});
test("Stripe test reads for founder review do not require or authorize Resend sending", async ()=>{
  let reads=0;
  const reviewOnly={...env,NOTIFICATION_SEND_MODE:"disabled",
    NOTIFICATION_OPERATOR_RELEASE:"false",NOTIFICATION_TEMPLATES_APPROVED:"false",
    FOUNDER_NOTIFICATION_ADMIN_MODE:"sandbox_access_only",
    FOUNDER_NOTIFICATION_REVIEW_ENABLED:"true"};
  const fake=async(_url,options)=>{
    reads++;
    assert.equal(options.method,"GET");
    return respond(checkout);
  };
  assert.equal((await stripeTestReadAdapter(reviewOnly,fake).checkout(sessionId)).id,sessionId);
  assert.equal(reads,1);
  assert.equal(await resendFounderTestTransport(reviewOnly,fake).templateIsPublished(alias),false);
  assert.equal(reads,1);
  for(const change of [
    {FOUNDER_NOTIFICATION_REVIEW_ENABLED:"false"},
    {FOUNDER_NOTIFICATION_ADMIN_MODE:"disabled"},
    {PAYMENTS_MODE:"disabled"},
    {STRIPE_TEST_SECRET_KEY:"sk_live_not_allowed"},
  ]) await assert.rejects(stripeTestReadAdapter({...reviewOnly,...change},fake).checkout(sessionId));
  assert.equal(reads,1);
});
test("Stripe rejects mismatched provider object and pagination", async ()=>{
  await assert.rejects(stripeTestReadAdapter(env,async()=>respond({...checkout,livemode:true})).checkout(sessionId));
  await assert.rejects(stripeTestReadAdapter(env,async()=>respond({...checkout,id:"cs_test_Other"})).checkout(sessionId));
  await assert.rejects(stripeTestReadAdapter(env,async()=>respond({...lineItems,has_more:true})).lineItems(sessionId));
  await assert.rejects(stripeTestReadAdapter(env,async()=>respond({...lineItems,data:[]})).lineItems(sessionId));
  await assert.rejects(stripeTestReadAdapter(env,async()=>respond({...refund,livemode:true})).refund(refundId));
  await assert.rejects(stripeTestReadAdapter(env,async()=>respond({error:"unauthorized"},401)).checkout(sessionId));
});
test("Resend refuses sending while disabled or template is not published", async ()=>{
  let count=0;
  const fake=async()=>{count++;return respond({object:"template",alias,status:"draft"});};
  const blocked=resendFounderTestTransport({...env,NOTIFICATION_OPERATOR_RELEASE:"false"},fake);
  assert.equal(await blocked.templateIsPublished(alias),false);
  await assert.rejects(blocked.send({to:email,templateAlias:alias,variables:{ORDER_REFERENCE:"TEST"},idempotencyKey:key,from:"Groundwork by Able <billing@groundworkbyable.com>"}));
  assert.equal(count,0);
  const draft=resendFounderTestTransport(env,fake);
  assert.equal(await draft.templateIsPublished(alias),false);
  await assert.rejects(draft.send({to:email,templateAlias:alias,variables:{ORDER_REFERENCE:"TEST"},idempotencyKey:key,from:"Groundwork by Able <billing@groundworkbyable.com>"}));
  assert.equal(count,2); // only draft lookups, never POST
});
test("Resend sends exact published template, fixed recipient and stable idempotency key", async ()=>{
  const called=[];
  const fake=async (url,opts)=>{
    called.push({url,opts});
    if(opts.method==="GET") return respond({object:"template",alias,status:"published",has_unpublished_versions:false});
    assert.equal(url,"https://api.resend.com/emails");
    assert.equal(opts.method,"POST");
    assert.equal(opts.headers["Idempotency-Key"],key);
    const payload=JSON.parse(opts.body);
    assert.deepEqual(payload.to,[email]);
    assert.equal(payload.template.id,alias);
    assert.equal(payload.template.variables.ORDER_REFERENCE,"TEST-001");
    assert.equal(payload.from,"Groundwork by Able <billing@groundworkbyable.com>");
    assert.equal(payload.text,undefined);
    return respond({id:"01a1de7c-664c-7a96-9e4c-f8a9589c1ee1"});
  };
  const adapter=resendFounderTestTransport(env,fake);
  assert.equal(await adapter.templateIsPublished(alias),true);
  const receipt=await adapter.send({to:email,templateAlias:alias,
    variables:{ORDER_REFERENCE:"TEST-001"},idempotencyKey:key,
    from:"Groundwork by Able <billing@groundworkbyable.com>"});
  assert.equal(receipt.id,"01a1de7c-664c-7a96-9e4c-f8a9589c1ee1");
  assert.equal(called.filter(x=>x.opts.method==="POST").length,1);
});
test("Resend refuses arbitrary recipients, templates, sender and malformed variables",async()=>{
  let count=0;
  const fake=async()=>{count++;return respond({object:"template",alias,status:"published",has_unpublished_versions:false});};
  const provider=resendFounderTestTransport(env,fake);
  const base={to:email,templateAlias:alias,variables:{ORDER_REFERENCE:"TEST"},idempotencyKey:key,from:"Groundwork by Able <billing@groundworkbyable.com>"};
  for(const edit of [
    {to:"other@example.com"},{templateAlias:"unauthorized-template"},
    {idempotencyKey:"bad"},{from:"Someone Else <billing@groundworkbyable.com>"},
    {variables:{UNSAFE_FIELD:"".padEnd(2100,"x")}},
  ])await assert.rejects(provider.send({...base,...edit}));
  assert.equal(count,0);
  const pending=resendFounderTestTransport(env,async()=>{count++;return respond({object:"template",alias,status:"published",has_unpublished_versions:true});});
  await assert.rejects(pending.send(base));
  assert.equal(count,1);
});


test("Workerd-compatible manual redirect refuses provider redirects without following them", async () => {
  let stripeCalls=0;
  const stripe=stripeTestReadAdapter(env,async(_url,options)=>{
    stripeCalls++;
    assert.equal(options.redirect,"manual");
    return respond({error:"redirect not followed"},302);
  });
  await assert.rejects(stripe.checkout(sessionId));
  assert.equal(stripeCalls,1);
  const resendCalls=[];
  const resend=resendFounderTestTransport(env,async(url,options)=>{
    resendCalls.push({url,options});
    assert.equal(options.redirect,"manual");
    return respond({error:"redirect not followed"},302);
  });
  assert.equal(await resend.templateIsPublished(alias),false);
  await assert.rejects(resend.send({to:email,templateAlias:alias,
    variables:{ORDER_REFERENCE:"TEST"},idempotencyKey:key,
    from:"Groundwork by Able <billing@groundworkbyable.com>"}));
  assert.equal(resendCalls.length,2);
  assert.ok(resendCalls.every(call=>call.options.method==="GET"));
});
