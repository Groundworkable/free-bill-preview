/**
 * Full draft HTTP -> signed buyer proof -> independently mocked Stripe TEST
 * checkout/charge and D1 -> returned signed attestation contract.
 * No provider credentials, actual Stripe/D1 I/O, checkout, email or deployment.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {handleDraftInternalPurchaseAttestation} from "./purchase_attestation_transport.draft.mjs";
import {
 canonicalIndependentBuyerProof,
 canonicalPurchaseAttestation,
} from "./purchase_attestation_producer.draft.mjs";

const ORDER="cs_test_IntegrationProxy1";
const OWNER="11111111-1111-4111-8111-111111111111";
const EMAIL="founder@example.invalid";
const TOKEN="gwti_"+("a".repeat(56));
const REQUEST_SECRET="synthetic-private-request-bound-signing-key-long";
const REQUEST_PATH="/internal/test-prepurchase-attestation";
const ACCESS_AUD="a".repeat(64);
const NOW=Math.floor(Date.now()/1000);
const sign=(key,v)=>createHmac("sha256",key).update(v).digest("hex");
const config=()=>({
 PURCHASE_ATTESTATION_TRANSPORT_MODE:"founder_test_only",
 PURCHASE_ATTESTATION_MODE:"sandbox_verified_buyer_only",
 PAYMENTS_MODE:"disabled",TERMS_APPROVED:"true",
 TERMS_VERSION:"prepurchase-v2026-11-17",
 STRIPE_TEST_SECRET_KEY:"sk_test_isolated_mock_never_network",
 MONTH_LINK_ID:"plink_MockMonthly",MONTH_PRICE_ID:"price_MockMonthly",
 ANNUAL_LINK_ID:"plink_MockAnnual",ANNUAL_PRICE_ID:"price_MockAnnual",
 PURCHASE_ATTESTATION_HMAC_SECRET:"test-payment-envelope-signing-secret-different",
 INDEPENDENT_BUYER_PROOF_HMAC_SECRET:"test-independent-identity-proof-signing-secret",
 PURCHASER_CONTACT_HMAC_SECRET:"test-independent-stripe-contact-hmac-secret",
 PURCHASE_ATTESTATION_INTERNAL_TOKEN:TOKEN,
 PURCHASE_ATTESTATION_REQUEST_AUTH_MODE:"signed_test_only",
 PURCHASE_ATTESTATION_REPLAY_MODE:"d1_atomic_nonce_v1",
 PURCHASE_ATTESTATION_ACCESS_MODE:"cloudflare_access_service_auth_only",
 PURCHASE_ATTESTATION_ACCESS_AUD:ACCESS_AUD,
 PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET:REQUEST_SECRET,
});
const url="https://groundwork-payment-sandbox-isolated.groundworkbyable.workers.dev/internal/test-prepurchase-attestation";
function signedProof(e,changes={}){
 const p={
  version:"gw-independent-buyer-proof-test-v1",
  issuer:"groundwork-verified-identity-service",
  orderReference:ORDER,verifiedOwnerId:OWNER,
  buyerContactHmac:sign(e.PURCHASER_CONTACT_HMAC_SECRET,
   "groundwork-stripe-checkout-contact-v1:"+EMAIL),
  buyerProofDigest:"1".repeat(64),issuedAt:NOW,
  expiresAt:NOW+90,nonce:"2".repeat(64),...changes,
 };
 return {proof:p,signature:sign(e.INDEPENDENT_BUYER_PROOF_HMAC_SECRET,
   canonicalIndependentBuyerProof(p))};
}
function records(){
 return {
  session:{object:"checkout.session",id:ORDER,livemode:false,mode:"payment",
   payment_status:"paid",payment_link:"plink_MockMonthly",payment_intent:"pi_Mock123",
   customer:"cus_Mock123",customer_details:{email:EMAIL},customer_email:EMAIL,
   consent:{terms_of_service:"accepted"},currency:"usd",amount_subtotal:999,
   amount_total:1089,total_details:{amount_tax:90,amount_shipping:0,amount_discount:0}},
  items:{has_more:false,data:[{quantity:1,amount_subtotal:999,
    price:{id:"price_MockMonthly",currency:"usd",unit_amount:999,
      tax_behavior:"exclusive",recurring:null}}]},
  intent:{id:"pi_Mock123",livemode:false,status:"succeeded",currency:"usd",
   amount_received:1089,amount:1089,latest_charge:"ch_Mock123"},
  charge:{id:"ch_Mock123",livemode:false,payment_intent:"pi_Mock123",
   status:"succeeded",paid:true,captured:true,currency:"usd",amount:1089,
   amount_refunded:0,refunded:false,disputed:false},
  order:{checkout_session_id:ORDER,payment_intent_id:"pi_Mock123",
   stripe_customer_id:"cus_Mock123",payment_link_id:"plink_MockMonthly",
   stripe_price_id:"price_MockMonthly",term:"monthly",
   terms_version:"prepurchase-v2026-11-17",
   subtotal_cents:999,tax_cents:90,total_cents:1089,currency:"usd",
   status:"paid_unfulfilled"},
 };
}
async function runCase({alterProof,alterRecords,changes,expectStatus=200}={}){
 const e={...config(),...changes};const rs=records();
 const seen=new Set();let replayWrites=0;
 alterRecords?.(rs);
 let stripeCalls=0,d1Calls=0;
 e.DB={
  prepare(sql){
   if(sql.includes("INSERT INTO prepurchase_attestation_request_nonces")){
    return {bind(n,t){return {async run(){
      replayWrites++;
      if(seen.has(n))throw new Error("SQLITE_CONSTRAINT_PRIMARYKEY");
      seen.add(n);
      assert.match(n,/^[a-f0-9]{64}$/);
      assert.ok(Number.isSafeInteger(t));
      return {success:true,meta:{changes:1}};
    }};}};
   }
   return {
    bind(...p){
     return {
      first:async()=>{
       d1Calls++;
       if(sql.includes("FROM prepurchase_orders")){
        assert.equal(p[0],ORDER);
        return rs.order;
       }
       if(sql.includes("FROM prepurchase_payment_changes"))return null;
       throw new Error("Unexpected D1 operation");
      },
     };
    },
   };
  },
 };
 const buyer=signedProof(e);alterProof?.(buyer);
 const body=JSON.stringify({sessionId:ORDER,buyerProof:buyer});
 const timestamp=String(Math.floor(Date.now()/1000));
 const nonce="f".repeat(64);
 const digest=sign(REQUEST_SECRET,JSON.stringify([
  "gw-test-transport-v1","POST",REQUEST_PATH,timestamp,nonce,body
 ]));
 const request=new Request(url,{method:"POST",headers:{
  Authorization:"Bearer "+TOKEN,"Content-Type":"application/json",
  "X-Groundwork-Test-Timestamp":timestamp,
  "X-Groundwork-Test-Nonce":nonce,
  "X-Groundwork-Test-Signature":digest,
 },body});
 const original=globalThis.fetch;
 globalThis.fetch=async(raw,init)=>{
  stripeCalls++;
  assert.equal(init.method,"GET");
  assert.equal(init.redirect,"error");
  assert.equal(init.cache,"no-store");
  assert.ok(init.signal);
  assert.equal(init.headers.Authorization,"Bearer "+e.STRIPE_TEST_SECRET_KEY);
  const p=new URL(raw).pathname;
  if(p.endsWith("/line_items"))return Response.json(rs.items);
  if(p.includes("/checkout/sessions/"))return Response.json(rs.session);
  if(p.includes("/payment_intents/"))return Response.json(rs.intent);
  if(p.includes("/charges/"))return Response.json(rs.charge);
  throw new Error("Unknown Stripe endpoint");
 };
 try{
  const resp=await handleDraftInternalPurchaseAttestation(request,e,undefined,{aud:ACCESS_AUD});
  assert.equal(resp.status,expectStatus);
  assert.equal(resp.headers.get("Cache-Control"),"no-store");
  return {resp,stripeCalls,d1Calls,replayWrites,e};
 }finally{globalThis.fetch=original}
}
test("full actual draft handler + producer verifies signed contact, TEST Stripe + immutable D1 and emits signed pending-only evidence",async()=>{
 const {resp,stripeCalls,d1Calls,replayWrites,e}=await runCase();
 assert.equal(stripeCalls,4);assert.equal(d1Calls,2);
 assert.equal(replayWrites,1);
 const signed=await resp.json();const p=signed.purchase;
 assert.equal(p.orderReference,ORDER);
 assert.equal(p.verifiedOwnerId,OWNER);
 assert.equal(p.totalCents,1089);
 assert.equal(p.offer,"monthly");
 assert.equal(p.status,"paid_unfulfilled");
 assert.equal(p.refundOrDisputeOpen,false);
 assert.equal(p.buyerProofMethod,"independent_mailbox_and_account_control");
 assert.equal(signed.signature,sign(e.PURCHASE_ATTESTATION_HMAC_SECRET,
  canonicalPurchaseAttestation(p)));
 assert.equal(JSON.stringify(signed).includes(EMAIL),false);
 assert.equal(JSON.stringify(signed).includes(TOKEN),false);
});
test("tampered or expired signed proof stops before Stripe and D1, even with valid internal bearer",async()=>{
 for(const alterProof of [
  p=>{p.signature="0".repeat(64)},
  p=>{p.proof.expiresAt=NOW-1},
  p=>{p.proof.verifiedOwnerId="22222222-2222-4222-8222-222222222222"},
 ]){
  const result=await runCase({alterProof,expectStatus:503});
  assert.equal(result.stripeCalls,0);assert.equal(result.d1Calls,0);
 }
});
test("valid signed proof never overrides changed Stripe contact, refund or D1 state",async()=>{
 for(const alterRecords of [
  r=>{r.session.customer_details.email="attacker@example.invalid"},
  r=>{r.charge.refunded=true},
  r=>{r.charge.amount_refunded=1089},
  r=>{r.order.status="refunded"},
 ]){
  const {resp}=await runCase({alterRecords,expectStatus:503});
  assert.equal(await resp.text(),"Attestation unavailable");
 }
});
test("payment receiver stays OFF: any re-enable denies before Stripe/D1",async()=>{
 for(const mode of ["sandbox","production"]){
  const {stripeCalls,d1Calls}=await runCase({
   changes:{PAYMENTS_MODE:mode},expectStatus:503
  });
  assert.equal(stripeCalls,0);assert.equal(d1Calls,0);
 }
});
