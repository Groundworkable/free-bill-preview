import test from "node:test";
import assert from "node:assert/strict";
import {createDraftAttestationEntryForTest} from "./private_attestation_entry.DRAFT_DO_NOT_DEPLOY.mjs";

const ORIGIN="https://synthetic-private-attestation.groundworkbyable.workers.dev";
const AUD="a".repeat(64);
const env=()=>({
 PURCHASE_ATTESTATION_PRIVATE_ORIGIN:ORIGIN,
 PURCHASE_ATTESTATION_ENTRY_MODE:"founder_test_only",
 PAYMENTS_MODE:"disabled",
 PURCHASE_ATTESTATION_ACCESS_MODE:"cloudflare_access_service_auth_only",
 PURCHASE_ATTESTATION_ACCESS_AUD:AUD,
 PURCHASE_ATTESTATION_TRANSPORT_MODE:"founder_test_only",
 PURCHASE_ATTESTATION_MODE:"sandbox_verified_buyer_only",
 PURCHASE_ATTESTATION_REQUEST_AUTH_MODE:"signed_test_only",
 PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET:"separate-private-test-HMAC-key-long-enough",
 INDEPENDENT_BUYER_PROOF_HMAC_SECRET:"separate-private-buyer-HMAC-key-long-enough",
 PURCHASE_ATTESTATION_HMAC_SECRET:"separate-private-purchase-HMAC-key-long-enough",
 PURCHASER_CONTACT_HMAC_SECRET:"separate-private-contact-HMAC-key-long-enough",
 PURCHASE_ATTESTATION_REPLAY_MODE:"d1_atomic_nonce_v1",
 PURCHASE_ATTESTATION_INTERNAL_TOKEN:"gwti_"+"A".repeat(56),
 DB:{prepare(){throw new Error("D1 must not be accessed")}},
});
const request=(pathname="/internal/test-prepurchase-attestation")=>
 new Request(ORIGIN+pathname,{method:"POST",headers:{
   "Content-Type":"application/json",
 },body:JSON.stringify({sessionId:"cs_test_SyntheticOnly",buyerProof:{}})});

test("private candidate never serves a request by default, not even Access-authenticated",async()=>{
 let calls=0;
 const handler=createDraftAttestationEntryForTest(async()=>{calls++;return {}});
 const r=await handler.fetch(request(),{...env(),PURCHASE_ATTESTATION_ENTRY_MODE:"disabled"},{access:{aud:AUD}});
 assert.equal(r.status,503);
 assert.equal(calls,0);
 assert.equal(r.headers.get("Cache-Control"),"no-store");
});

test("candidate refuses missing origin and forbidden original webhook Worker host",async()=>{
 const handler=createDraftAttestationEntryForTest(async()=>{throw Error("should not run")});
 for(const origin of [
  undefined,
  "https://groundwork-payment-sandbox-isolated.groundworkbyable.workers.dev",
  "https://example.invalid",
 ]){
  const r=await handler.fetch(request(),{
   ...env(),PURCHASE_ATTESTATION_PRIVATE_ORIGIN:origin,
  },{access:{aud:AUD}});
  assert.equal(r.status,503);
 }
});

test("private entry refuses Stripe webhooks and all wrong origins/paths before any D1 or verifier",async()=>{
 let calls=0;
 const handler=createDraftAttestationEntryForTest(async()=>{calls++;return {}});
 for(const url of [
  ORIGIN+"/webhooks/stripe",
  ORIGIN+"/internal/unrelated",
  ORIGIN+"/internal/test-prepurchase-attestation?debug=1",
  "https://example.invalid/internal/test-prepurchase-attestation",
  "http://groundwork-payment-sandbox-isolated.groundworkbyable.workers.dev/internal/test-prepurchase-attestation",
 ]){
  const r=await handler.fetch(new Request(url,{method:"POST",body:"{}"}),env(),{access:{aud:AUD}});
  assert.equal(r.status,404);
 }
 assert.equal(calls,0);
});

test("context is mandatory and request-supplied forged Access assertion never authorizes",async()=>{
 let calls=0;
 const handler=createDraftAttestationEntryForTest(async()=>{calls++;return {}});
 for(const ctx of [undefined,{}, {access:null}, {access:{aud:"wrong"}}]){
  const r=await handler.fetch(new Request(request(),{
   headers:{
    "Content-Type":"application/json",
    "CF-Access-Authenticated-User-Email":"forged@example.invalid",
    "X-Cloudflare-Access-Aud":AUD,
    "Cf-Access-Jwt-Assertion":"forged",
   }
  }),env(),ctx);
  assert.equal(r.status,403);
 }
 assert.equal(calls,0);
});

test("a matching platform Access context does not bypass bearer and body HMAC checks",async()=>{
 let calls=0;
 const handler=createDraftAttestationEntryForTest(async()=>{calls++;return {}});
 const r=await handler.fetch(request(),env(),{access:{aud:AUD}});
 assert.equal(r.status,401);
 assert.equal(calls,0);
});

test("existing disabled webhook receiver mode cannot serve private attestation by accident",async()=>{
 const handler=createDraftAttestationEntryForTest(async()=>{throw Error("MUST NOT RUN")});
 for(const mode of ["sandbox","live",undefined]){
  const r=await handler.fetch(request(),{...env(),PAYMENTS_MODE:mode},{access:{aud:AUD}});
  assert.equal(r.status,503);
 }
});
