import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {handleDraftInternalPurchaseAttestation as rawDraftHandler} from "./purchase_attestation_transport.draft.mjs";
const ACCESS_AUD="a".repeat(64);
const handleDraftInternalPurchaseAttestation=(request,env,issue,access={aud:ACCESS_AUD})=>
  rawDraftHandler(request,env,issue,access);
import {canonicalIndependentBuyerProof} from "./purchase_attestation_producer.draft.mjs";

const TOKEN="gwti_"+("A".repeat(56));
const REQUEST_SECRET="synthetic-separate-request-auth-hmac-key-32plus";
const BUYER_SECRET="synthetic-independent-buyer-proof-secret-32plus";
const stamp=()=>String(Math.floor(Date.now()/1000));
const nonce="a".repeat(64);
const path="/internal/test-prepurchase-attestation";
function signature(raw,t,n=nonce){
 return createHmac("sha256",REQUEST_SECRET)
  .update(JSON.stringify(["gw-test-transport-v1","POST",path,t,n,raw]))
  .digest("hex");
}
const env=()=>{
  const seen=new Set();
  return {
  DB:{
    prepare(sql){
      assert.match(sql,/INSERT INTO prepurchase_attestation_request_nonces/);
      return {bind(n,t){return {async run(){
        if(!/^[a-f0-9]{64}$/.test(n)||!Number.isSafeInteger(t))
          throw new Error("invalid synthetic nonce");
        if(seen.has(n))throw new Error("SQLITE_CONSTRAINT_PRIMARYKEY");
        seen.add(n);
        return {success:true,meta:{changes:1}};
      }}; }};
    }
  },
  PURCHASE_ATTESTATION_REPLAY_MODE:"d1_atomic_nonce_v1",
  PURCHASE_ATTESTATION_ACCESS_MODE:"cloudflare_access_service_auth_only",
  PURCHASE_ATTESTATION_ACCESS_AUD:ACCESS_AUD,
  INDEPENDENT_BUYER_PROOF_HMAC_SECRET:BUYER_SECRET,
  PURCHASE_ATTESTATION_TRANSPORT_MODE:"founder_test_only",
  PURCHASE_ATTESTATION_MODE:"sandbox_verified_buyer_only",
  PAYMENTS_MODE:"disabled",
  PURCHASE_ATTESTATION_INTERNAL_TOKEN:TOKEN,
  PURCHASE_ATTESTATION_REQUEST_AUTH_MODE:"signed_test_only",
  PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET:REQUEST_SECRET,
};};
const url="https://groundwork-payment-sandbox-isolated.groundworkbyable.workers.dev/internal/test-prepurchase-attestation";
const body=()=>{
 const now=Math.floor(Date.now()/1000);
 const proof={
  version:"gw-independent-buyer-proof-test-v1",
  issuer:"groundwork-verified-identity-service",
  orderReference:"cs_test_SyntheticOrder",
  verifiedOwnerId:"11111111-1111-4111-8111-111111111111",
  buyerContactHmac:"a".repeat(64),buyerProofDigest:"b".repeat(64),
  issuedAt:now,expiresAt:now+90,nonce:"c".repeat(64),
 };
 const signed=createHmac("sha256",BUYER_SECRET)
  .update(canonicalIndependentBuyerProof(proof)).digest("hex");
 return {sessionId:"cs_test_SyntheticOrder",buyerProof:{proof,signature:signed}};
};
const req=(override={})=>{
  const raw=override.body===undefined?JSON.stringify(body()):override.body;
  const t=stamp();
  const headers=override.headers??{
    "Authorization":"Bearer "+TOKEN,"Content-Type":"application/json",
    "X-Groundwork-Test-Timestamp":t,
    "X-Groundwork-Test-Nonce":nonce,
    "X-Groundwork-Test-Signature":signature(raw,t),
  };
  return new Request(override.url??url,{
    method:override.method??"POST",headers,body:raw,
  });
};
const result={purchase:{version:"gw-prepurchase-test-v1",orderReference:"cs_test_SyntheticOrder"},signature:"b".repeat(64)};
const issue=async()=>result;

test("default-closed adapter never calls its signer even with valid request",async()=>{
  let calls=0;
  const r=await handleDraftInternalPurchaseAttestation(req(),{
    ...env(),PURCHASE_ATTESTATION_TRANSPORT_MODE:"disabled",
  },async()=>{calls++;return result});
  assert.equal(r.status,503);assert.equal(calls,0);
});

test("Cloudflare Access authentication is mandatory before verifier, D1 and buyer-proof checks",async()=>{
 const e=env();
 let calls=0, dbReads=0;
 const original=e.DB.prepare;
 e.DB.prepare=(...args)=>{dbReads++;return original(...args)};
 for(const access of [undefined,null,{aud:"wrong"},{aud:""},{email:"forged@example.invalid"}]){
  const r=await rawDraftHandler(req(),e,async()=>{calls++;return result},access);
  assert.equal(r.status,403);
 }
 assert.equal(dbReads,0);
 assert.equal(calls,0);
});
test("receiver may not be re-enabled, nor producer mode changed",async()=>{
  for(const override of [
    {PAYMENTS_MODE:"sandbox"},{PAYMENTS_MODE:"live"},
    {PURCHASE_ATTESTATION_ACCESS_MODE:"disabled"},
    {PURCHASE_ATTESTATION_ACCESS_AUD:"invalid"},
    {PURCHASE_ATTESTATION_REQUEST_AUTH_MODE:"disabled"},
    {PURCHASE_ATTESTATION_REPLAY_MODE:"disabled"},
    {DB:null},
    {PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET:"short"},
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
    {url:"https://attacker.example.invalid/internal/test-prepurchase-attestation",expected:404},
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

test("request HMAC rejects altered body, stale timestamp and wrong signature before handler",async()=>{
 let calls=0;
 const t=stamp();
 const raw=JSON.stringify(body());
 const altered=JSON.stringify({...body(),sessionId:"cs_test_Altered"});
 const cases=[
  {raw:altered,t,signature:signature(raw,t)},
  {raw,t:String(Number(t)-120),signature:signature(raw,String(Number(t)-120))},
  {raw,t,signature:"0".repeat(64)},
 ];
 for(const c of cases){
  const request=new Request(url,{method:"POST",headers:{
   "Authorization":"Bearer "+TOKEN,
   "Content-Type":"application/json",
   "X-Groundwork-Test-Timestamp":c.t,
   "X-Groundwork-Test-Nonce":nonce,
   "X-Groundwork-Test-Signature":c.signature,
  },body:c.raw});
  const r=await handleDraftInternalPurchaseAttestation(request,env(),async()=>{
   calls++;return result;
  });
  assert.equal(r.status,401);
 }
 assert.equal(calls,0);
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
  const t=stamp();const raw=JSON.stringify(body());
  const r=await handleDraftInternalPurchaseAttestation(req({headers:{
    "Authorization":"Bearer "+TOKEN,"Content-Type":"application/json",
    "Content-Length":"99999999",
    "X-Groundwork-Test-Timestamp":t,
    "X-Groundwork-Test-Nonce":nonce,
    "X-Groundwork-Test-Signature":signature(raw,t),
  }}),env(),async()=>{calls++;return result});
  assert.equal(r.status,413);assert.equal(calls,0);
});

test("authorized TEST-only request delegates exactly one purchase verification and returns only signed envelope",async()=>{
  let calls=0;
  const r=await handleDraftInternalPurchaseAttestation(req(),env(),async(e,id,proof)=>{
    assert.equal(e.PAYMENTS_MODE,"disabled");
    assert.equal(id,"cs_test_SyntheticOrder");
    assert.equal(proof.proof.orderReference,"cs_test_SyntheticOrder");
    assert.match(proof.signature,/^[a-f0-9]{64}$/);
    calls++;return result;
  });
  assert.equal(calls,1);
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),result);
  assert.equal(r.headers.get("Cache-Control"),"no-store");
  assert.equal(r.headers.get("X-Content-Type-Options"),"nosniff");
});

test("durable nonce ledger denies replay without calling provider twice",async()=>{
  const binding=env();
  let calls=0;
  const r1=await handleDraftInternalPurchaseAttestation(req(),binding,async()=>{
    calls++;return result;
  });
  assert.equal(r1.status,200);
  const r2=await handleDraftInternalPurchaseAttestation(req(),binding,async()=>{
    calls++;return result;
  });
  assert.equal(r2.status,503);
  assert.equal(calls,1);
});

test("missing or broken nonce ledger denies before provider I/O",async()=>{
  for(const db of [
    null,
    {prepare(){throw new Error("missing nonce table")}},
    {prepare(){return {bind(){return {run:async()=>({
      success:true,meta:{changes:0}
    })}}}}},
    {prepare(){return {bind(){return {run:async()=>({
      success:false,meta:{changes:1}
    })}}}}},
  ]){
    let calls=0;
    const r=await handleDraftInternalPurchaseAttestation(req(),{
      ...env(),DB:db,
    },async()=>{calls++;return result});
    assert.equal(r.status,db===null?503:503);
    assert.equal(calls,0);
  }
});

test("provider/DB errors do not reveal internal details",async()=>{
  const secret="sensitive_provider_details_should_not_appear";
  const r=await handleDraftInternalPurchaseAttestation(req(),env(),async()=>{
    throw new Error(secret);
  });
  assert.equal(r.status,503);
  assert.equal((await r.text()).includes(secret),false);
});
