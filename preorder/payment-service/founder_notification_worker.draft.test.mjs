import test from "node:test";
import assert from "node:assert/strict";
import { createFounderNotificationWorker } from "./founder_notification_worker.draft.mjs";

const KEY = "gwn1_" + "a".repeat(64);
const FROM = "https://isolated-worker.test";
const env = Object.freeze({
  FOUNDER_NOTIFICATION_ADMIN_MODE: "sandbox_access_only",
  FOUNDER_ACCESS_AUD: "founder-access-app-audience-id",
  FOUNDER_ACCESS_EMAIL: "founder@example.com",
  FOUNDER_NOTIFICATION_DISPATCH_ENABLED: "true",
  NOTIFICATION_SEND_MODE: "sandbox_founder_test",
  NOTIFICATION_OPERATOR_RELEASE: "true",
  NOTIFICATION_TEMPLATES_APPROVED: "true",
  PAYMENTS_MODE: "sandbox",
  TERMS_APPROVED: "true",
  TERMS_VERSION: "prepurchase-v2026-11-15",
  DB: { __sandbox: true },
});
const ctx = (aud=env.FOUNDER_ACCESS_AUD,email=env.FOUNDER_ACCESS_EMAIL) => ({
  access: { aud, async getIdentity() {return { email };} },
});
const row = (overrides={}) => ({
  notification_key: KEY,
  checkout_session_id: "cs_test_Founder001",
  notice_type: "purchase_confirmation",
  state: "review_verified",
  review_completed_at: "2026-11-15 15:00:00",
  ...overrides,
});
function fixture(overrides={}) {
  const events = { send:0, provider:0, store:0, lookup:0, transport:0 };
  const record = overrides.row === undefined ? row() : overrides.row;
  const worker = createFounderNotificationWorker({
    createStore(db) {
      assert.equal(db, env.DB);
      events.store++;
      return { async get(key) { events.lookup++; return key === KEY ? record : null; } };
    },
    createStripe() { events.provider++; return {}; },
    createResend() { events.transport++; return {}; },
    async sender(receivedEnv,key,adapters) {
      assert.equal(receivedEnv,env);
      assert.equal(key,KEY);
      assert.equal(await adapters.approval.isAuthorized(KEY,record),true);
      events.send++;
      return { status:"provider_accepted_await_delivery_evidence" };
    },
  });
  return {worker,events};
}
const request = (path,options) => new Request(FROM+path,options);
const send = (options={})=>request("/founder/notifications/dispatch",{
  method: "POST",
  headers: {
    "Content-Type":"application/json",
    "X-Groundwork-Operator-Action":"founder-dispatch",
    ...(options.headers||{}),
  },
  body: options.body === undefined
    ? JSON.stringify({notificationKey:KEY,confirm:"SEND_FOUNDER_TEST_NOTICE"})
    : options.body,
});
async function outcome(worker,req,configuration=env,context=ctx()) {
  const response=await worker.fetch(req,configuration,context);
  return { code:response.status, payload:await response.json(),headers:response.headers };
}

test("default disabled even when a request pretends to be authenticated",async()=>{
  const {worker,events}=fixture();
  const result=await outcome(worker,send(),{...env,FOUNDER_NOTIFICATION_ADMIN_MODE:"disabled"},ctx());
  assert.equal(result.code,503);
  assert.deepEqual(result.payload,{status:"service_disabled"});
  assert.equal(events.send,0);
  const noAccess=await outcome(worker,send(),env,{});
  assert.equal(noAccess.code,403);
  assert.equal(events.send,0);
});

test("Access audience and identity are required, spoofed headers have no authority",async()=>{
  const {worker,events}=fixture();
  const denied = [
    ctx("other-app-audience","founder@example.com"),
    ctx(env.FOUNDER_ACCESS_AUD,"intruder@example.com"),
    {access:{aud:env.FOUNDER_ACCESS_AUD,getIdentity:async()=>{throw Error("invalid Access");}}},
    {},
  ];
  for (const context of denied) {
    const res=await outcome(worker,send({headers:{"Cf-Access-Jwt-Assertion":"forged"}}),env,context);
    assert.equal(res.code,403);
    assert.equal(res.payload.status,"access_denied");
  }
  assert.equal(events.store,0);
  assert.equal(events.send,0);
});

test("unknown routes and unsupported methods cannot invoke notification send",async()=>{
  const {worker,events}=fixture();
  assert.equal((await outcome(worker,request("/__test/notification/dispatch",{method:"POST"}))).code,404);
  assert.equal((await outcome(worker,request("/founder/notifications/dispatch",{method:"GET"}))).code,405);
  assert.equal((await outcome(worker,request("/founder/notifications/status",{method:"POST"}))).code,405);
  assert.equal(events.send,0);
});

test("founder can inspect only narrow status fields without recipient identity",async()=>{
  const {worker,events}=fixture();
  const result=await outcome(worker,request("/founder/notifications/status?key="+KEY));
  assert.equal(result.code,200);
  assert.deepEqual(result.payload,{status:"found",noticeType:"purchase_confirmation",state:"review_verified",reviewed:true});
  assert.equal(result.headers.get("Cache-Control"),"no-store, private");
  const bad=await outcome(worker,request("/founder/notifications/status?key="+KEY+"&all=1"));
  assert.equal(bad.code,400);
  assert.equal(events.send,0);
});

test("dispatch requires independently verified review and rejects unreleased copy",async()=>{
  for (const change of [
    {state:"review_pending"},
    {state:"manual_review"},
    {review_completed_at:null},
    {notice_type:"delivery_update"},
  ]) {
    const {worker,events}=fixture({row:row(change)});
    const res=await outcome(worker,send());
    assert.equal(res.code,409,JSON.stringify(res.payload));
    assert.equal(events.send,0);
  }
});

test("dispatch stays disabled when any independent release gate is closed",async()=>{
  for(const [key,value] of [
    ["FOUNDER_NOTIFICATION_DISPATCH_ENABLED","false"],
    ["NOTIFICATION_SEND_MODE","disabled"],
    ["NOTIFICATION_OPERATOR_RELEASE","false"],
    ["NOTIFICATION_TEMPLATES_APPROVED","false"],
    ["PAYMENTS_MODE","disabled"],
    ["TERMS_APPROVED","false"],
    ["TERMS_VERSION","UNAPPROVED"],
  ]) {
    const {worker,events}=fixture();
    const res=await outcome(worker,send(),{...env,[key]:value});
    assert.equal(res.code,503,key);
    assert.equal(events.send,0);
  }
});

test("operator must explicitly confirm and cannot cross origin or inject fields",async()=>{
  for (const requestOptions of [
    {headers:{"Origin":"https://attacker.example"}},
    {headers:{"X-Groundwork-Operator-Action":"wrong"}},
    {headers:{"Content-Type":"text/plain"}},
    {body:JSON.stringify({notificationKey:KEY,confirm:"wrong"})},
    {body:JSON.stringify({notificationKey:KEY,confirm:"SEND_FOUNDER_TEST_NOTICE",to:"victim@example.com"})},
    {body:JSON.stringify({notificationKey:KEY,confirm:"SEND_FOUNDER_TEST_NOTICE"})+" ".repeat(520)},
  ]) {
    const {worker,events}=fixture();
    const res=await outcome(worker,send(requestOptions));
    assert.ok([400,403].includes(res.code),JSON.stringify(res));
    assert.equal(events.send,0);
  }
});

test("only explicitly released, reviewed test can call injected trusted sender once",async()=>{
  const {worker,events}=fixture();
  const res=await outcome(worker,send());
  assert.equal(res.code,200,JSON.stringify(res.payload));
  assert.equal(res.payload.status,"provider_accepted_await_delivery_evidence");
  assert.equal(events.send,1);
  assert.equal(events.lookup,1);
  assert.equal(events.provider,1);
  assert.equal(events.transport,1);
});

test("sender errors are sanitized without disclosing sensitive details",async()=>{
  const worker=createFounderNotificationWorker({
    createStore:()=>({get:async()=>row()}),
    createStripe:()=>({}),
    createResend:()=>({}),
    sender:async()=>{throw Error("INTERNAL_CREDENTIAL_DO_NOT_LEAK");},
  });
  const res=await outcome(worker,send());
  assert.equal(res.code,503);
  assert.deepEqual(res.payload,{status:"manual_reconciliation_required"});
  assert.ok(!JSON.stringify(res.payload).includes("CREDENTIAL"));
});
