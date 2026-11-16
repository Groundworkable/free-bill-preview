import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { prepareFounderTestPurchaseOutbox } from "./notification_outbox_enqueue.draft.mjs";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const recipient="founder@example.com";
const session=()=>({
  id:"cs_test_RealProviderFixture001",livemode:false,payment_status:"paid",
  consent:{terms_of_service:"accepted"},
  customer_details:{email:recipient},customer_email:null,
});
const order=()=>({id:session().id,status:"paid_unfulfilled"});
const enabled=()=>({
  FOUNDER_NOTIFICATION_OUTBOX_MODE:"sandbox_founder_only",
  PAYMENTS_MODE:"sandbox",TERMS_APPROVED:"true",
  TERMS_VERSION:"prepurchase-v2026-11-16",
  STRIPE_TEST_SECRET_KEY:"sk_test_fixture_only",
  NOTIFICATION_SEND_MODE:"disabled",
  FOUNDER_NOTIFICATION_DISPATCH_ENABLED:"false",
  NOTIFICATION_OPERATOR_RELEASE:"false",
  NOTIFICATION_TEST_RECIPIENT:recipient,
  NOTIFICATION_RECIPIENT_HMAC_SECRET:"synthetic-outbox-hmac-secret-at-least-32",
});

test("disabled opt-in is an exact no-op",async()=>{
  assert.equal(await prepareFounderTestPurchaseOutbox({},session(),order()),null);
  assert.equal(await prepareFounderTestPurchaseOutbox(
    {...enabled(),FOUNDER_NOTIFICATION_OUTBOX_MODE:"disabled"},session(),order()),null);
});

test("verified allowlisted Stripe TEST purchase creates stable pending-only HMAC identity",async()=>{
  const first=await prepareFounderTestPurchaseOutbox(enabled(),session(),order());
  const again=await prepareFounderTestPurchaseOutbox(enabled(),session(),order());
  assert.deepEqual(first,again);
  assert.match(first.notificationKey,/^gwn1_[0-9a-f]{64}$/);
  assert.match(first.recipientHmac,/^[0-9a-f]{64}$/);
  assert.equal(first.checkoutSessionId,session().id);
  assert.equal(first.noticeType,"purchase_confirmation");
  assert.equal(first.noticeRef,"purchase");
  assert.equal(first.templateAlias,"groundwork-prepurchase-confirmation-review");
  assert.ok(!JSON.stringify(first).includes(recipient));
  assert.equal(first.state,undefined);
  assert.equal(first.review_completed_at,undefined);
  assert.equal(first.attempt_token,undefined);
  assert.equal(first.provider_message_id,undefined);
});

test("any missing independent safety gate rejects before producing an outbox entry",async()=>{
  for(const change of [
    {PAYMENTS_MODE:"disabled"},{TERMS_APPROVED:"false"},
    {TERMS_VERSION:"UNAPPROVED"},{STRIPE_TEST_SECRET_KEY:"sk_live_unacceptable"},
    {NOTIFICATION_SEND_MODE:"sandbox_founder_test"},
    {FOUNDER_NOTIFICATION_DISPATCH_ENABLED:"true"},
    {NOTIFICATION_OPERATOR_RELEASE:"true"},
    {NOTIFICATION_RECIPIENT_HMAC_SECRET:"short"},
  ]) {
    await assert.rejects(prepareFounderTestPurchaseOutbox({...enabled(),...change},session(),order()),
      /preflight failed/,JSON.stringify(change));
  }
});

test("bad or conflicting paid session and recipient identity can never enter pending outbox",async()=>{
  for(const change of [
    {livemode:true},{payment_status:"unpaid"},
    {consent:{terms_of_service:"not_accepted"}},
    {id:"cs_live_123"},
    {customer_details:{email:"other@example.com"}},
    {customer_email:"other@example.com"},
    {customer_email:"conflict@example.com"},
    {customer_details:null,customer_email:null},
  ]) await assert.rejects(
    prepareFounderTestPurchaseOutbox(enabled(),{...session(),...change},order())
  );
  await assert.rejects(prepareFounderTestPurchaseOutbox(enabled(),session(),{
    ...order(),id:"cs_test_Mismatched"
  }));
  await assert.rejects(prepareFounderTestPurchaseOutbox(enabled(),session(),{
    ...order(),status:"active_membership"
  }));
});

test("each distinct verified checkout receives a distinct deterministic key",async()=>{
  const original=await prepareFounderTestPurchaseOutbox(enabled(),session(),order());
  const otherId="cs_test_AnotherProviderFixture";
  const different=await prepareFounderTestPurchaseOutbox(enabled(),{
    ...session(),id:otherId
  },{...order(),id:otherId});
  assert.notEqual(original.notificationKey,different.notificationKey);
  assert.equal(original.recipientHmac,different.recipientHmac);
});
