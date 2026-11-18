import test from "node:test";
import assert from "node:assert/strict";
import {handleDraftInternalPurchaseAttestation} from "./purchase_attestation_transport.draft.mjs";

const TOKEN="gwti_"+("A".repeat(56));
const env=()=>({
  PURCHASE_ATTESTATION_TRANSPORT_MODE:"founder_test_only",
  PURCHASE_ATTESTATION_MODE:"sandbox_verified_buyer_only",
  PAYMENTS_MODE:"disabled",
  PURCHASE_ATTESTATION_INTERNAL_TOKEN:TOKEN,
});
const url="https://isolated.internal.invalid/internal/test-prepurchase-attestation";
const body=()=>({sessionId:"cs_test_SyntheticOrder",buyerProof:{
  proof:{version:"synthetic-only",issuer:"synthetic-only"},signature:"a".repeat(64)
}});
const req=(override={})=>new Request(override.url??url,{
  method:override.method??"POST",
  headers:override.headers??{"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"},
  body:override.body===undefined?JSON.stringify(body()):override.body,
});
const result={purchase:{version:"gw-prepurchase-test-v1",orderReference:"cs_test_SyntheticOrder"},signature:"b".repeat(64)};
const issue=async()=>result;

test("default-closed adapter never calls its signer even with valid request",async()=>{
  let calls=0;
  const r=await handleDraftInternalPurchaseAttestation(req(),{
    ...env(),PURCHASE_ATTESTATION_TRANSPORT_MODE:"disabled",
  },async()=>{calls++;return result});
  assert.equal(r.status,503);assert.equal(calls,0);
});

test("receiver may not be re-enabled, nor producer mode changed",async()=>{
  for(const override of [
    {PAYMENTS_MODE:"sandbox"},{PAYMENTS_MODE:"live"},
    {PURCHASE_ATTESTATION_MODE:"disabled"},{PURCHASE_ATTESTATION_INTERNAL_TOKEN:"weak"},
  ]){
    let calls=0;
    const r=await handleDraftInternalPurchaseAttestation(req(),{
      ...env(),...override,
    },async()=>{calls++;return result});
    assert.equal(r.status,503);
    assert.equal(calls,0);
  }
});

test("HTTP method, path, query, scheme and bearer authentication are required",async()=>{
  const cases=[
    {method:"PUT",expected:405,headers:{"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"}},
    {url:"https://isolated.internal.invalid/internal/other",expected:404},
    {url:url+"?token=sensitive",expected:404},
    {url:"http://isolated.internal.invalid/internal/test-prepurchase-attestation",expected:404},
    {headers:{"Authorization":"Bearer wrong","Content-Type":"application/json"},expected:401},
    {headers:{"Content-Type":"application/json"},expected:401},
    {headers:{"Authorization":"Bearer "+TOKEN,"Content-Type":"text/plain"},expected:415},
  ];
  for(const c of cases) {
    let calls=0;
    const r=await handleDraftInternalPurchaseAttestation(req(c),env(),async()=>{
      calls++;return result;
    });
    assert.equal(r.status,c.expected);
    assert.equal(calls,0);
  }
});

test("oversized, malformed, unexpected and invalid-order payloads are rejected before verification",async()=>{
  const invalid=[
    {body:"not json",expected:400},
    {body:JSON.stringify({sessionId:"cs_live_123",buyerProof:{}}),expected:400},
    {body:JSON.stringify({...body(),admin:true}),expected:400},
    {body:JSON.stringify({sessionId:"cs_test_ok",buyerProof:null}),expected:400},
    {body:"x".repeat(16390),expected:413},
  ];
  for(const c of invalid) {
    let calls=0;
    const r=await handleDraftInternalPurchaseAttestation(req(c),env(),async()=>{
      calls++;return result;
    });
    assert.equal(r.status,c.expected);
    assert.equal(calls,0);
  }
  let calls=0;
  const r=await handleDraftInternalPurchaseAttestation(req({headers:{
    "Authorization":"Bearer "+TOKEN,"Content-Type":"application/json","Content-Length":"99999999",
  }}),env(),async()=>{calls++;return result});
  assert.equal(r.status,413);assert.equal(calls,0);
});

test("authorized TEST-only request delegates exactly one purchase verification and returns only signed envelope",async()=>{
  let calls=0;
  const r=await handleDraftInternalPurchaseAttestation(req(),env(),async(e,id,proof)=>{
    assert.equal(e.PAYMENTS_MODE,"disabled");
    assert.equal(id,"cs_test_SyntheticOrder");
    assert.deepEqual(proof,body().buyerProof);
    calls++;return result;
  });
  assert.equal(calls,1);
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),result);
  assert.equal(r.headers.get("Cache-Control"),"no-store");
  assert.equal(r.headers.get("X-Content-Type-Options"),"nosniff");
});

test("provider/DB errors do not reveal internal details",async()=>{
  const secret="sensitive_provider_details_should_not_appear";
  const r=await handleDraftInternalPurchaseAttestation(req(),env(),async()=>{
    throw new Error(secret);
  });
  assert.equal(r.status,503);
  assert.equal((await r.text()).includes(secret),false);
});
