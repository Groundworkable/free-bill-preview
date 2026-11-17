import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {
  canonicalPurchaseAttestation,
  canonicalIndependentBuyerProof,
  prepareSignedTestPurchaseAttestation,
} from "./purchase_attestation_producer.draft.mjs";

const now=Math.floor(Date.now()/1000);
const orderId="cs_test_Handoff001";
const customerId="cus_Test1";
const paymentIntent="pi_Test123";
const chargeId="ch_Test123";
const buyer="founder@example.invalid";
const verifiedOwner="11111111-1111-4111-8111-111111111111";
const envBase=()=>({
  PURCHASE_ATTESTATION_MODE:"sandbox_verified_buyer_only",
  PAYMENTS_MODE:"sandbox",TERMS_APPROVED:"true",
  TERMS_VERSION:"prepurchase-v2026-11-16",
  STRIPE_TEST_SECRET_KEY:"sk_test_synthetic_no_network",
  MONTH_LINK_ID:"plink_TestMonthly", MONTH_PRICE_ID:"price_TestMonthly",
  ANNUAL_LINK_ID:"plink_TestAnnual", ANNUAL_PRICE_ID:"price_TestAnnual",
  PURCHASE_ATTESTATION_HMAC_SECRET:"synthetic-payment-attestation-key-length-over-32",
  INDEPENDENT_BUYER_PROOF_HMAC_SECRET:"synthetic-independent-buyer-proof-key-32-plus",
  PURCHASER_CONTACT_HMAC_SECRET:"synthetic-checkout-contact-binding-key-32",
});
const stripePurchase=(annual=false)=>{
 const amount=annual?9600:999;
 return {
  session:{object:"checkout.session",id:orderId,livemode:false,mode:"payment",
    payment_status:"paid",payment_link:annual?"plink_TestAnnual":"plink_TestMonthly",
    payment_intent:paymentIntent,customer:customerId,
    customer_details:{email:buyer},customer_email:buyer,consent:{terms_of_service:"accepted"},
    currency:"usd",amount_subtotal:amount,amount_total:amount+60,
    total_details:{amount_tax:60,amount_shipping:0,amount_discount:0}},
  lineItems:{has_more:false,data:[{quantity:1,amount_subtotal:amount,
    price:{id:annual?"price_TestAnnual":"price_TestMonthly",
      currency:"usd",unit_amount:amount,tax_behavior:"exclusive",recurring:null}}]},
  intent:{id:paymentIntent,livemode:false,status:"succeeded",currency:"usd",
    amount_received:amount+60,amount:amount+60,latest_charge:chargeId},
  charge:{id:chargeId,livemode:false,payment_intent:paymentIntent,status:"succeeded",
    paid:true,captured:true,currency:"usd",amount:amount+60,amount_refunded:0,
    refunded:false,disputed:false},
  recorded:{checkout_session_id:orderId,payment_intent_id:paymentIntent,
    stripe_customer_id:customerId,
    payment_link_id:annual?"plink_TestAnnual":"plink_TestMonthly",
    stripe_price_id:annual?"price_TestAnnual":"price_TestMonthly",
    term:annual?"annual":"monthly",terms_version:"prepurchase-v2026-11-16",
    subtotal_cents:amount,tax_cents:60,total_cents:amount+60,
    currency:"usd",status:"paid_unfulfilled"},
 };
};
const sign=(key,message)=>createHmac("sha256",key).update(message).digest("hex");
const buyerProof=(env,alter={})=>{
 const p={
  version:"gw-independent-buyer-proof-test-v1",
  issuer:"groundwork-verified-identity-service",
  orderReference:orderId,
  verifiedOwnerId:verifiedOwner,
  buyerContactHmac:sign(env.PURCHASER_CONTACT_HMAC_SECRET,
    "groundwork-stripe-checkout-contact-v1:"+buyer),
  buyerProofDigest:"a".repeat(64),
  issuedAt:now,expiresAt:now+60,nonce:"b".repeat(64),
  ...alter
 };
 return {proof:p,signature:sign(env.INDEPENDENT_BUYER_PROOF_HMAC_SECRET,
   canonicalIndependentBuyerProof(p))};
};
const verifiedAppConsumer=(att,env)=>{
 const p=att.purchase;
 const expected=sign(env.PURCHASE_ATTESTATION_HMAC_SECRET, JSON.stringify([
  p.version,p.issuer,p.orderReference,p.paymentIntent,p.priceId,
  p.offer,p.subtotalCents,p.taxCents,p.totalCents,p.termsVersion,
  p.verifiedOwnerId,p.buyerProofDigest,p.buyerProofMethod,p.status,
  p.termsAccepted,p.refundOrDisputeOpen,p.issuedAt,p.expiresAt,p.nonce
 ]));
 return att.signature===expected;
};
async function call(overrides={}){
 const env={...envBase(),...overrides.env};
 const stripe=stripePurchase(overrides.annual===true);
 if(overrides.modifyStripe)overrides.modifyStripe(stripe);
 const queries=[];
 const db={
  prepare(sql){
   return {bind(...params){
    return {first:async()=>{
      queries.push({sql,params});
      if(sql.includes("FROM prepurchase_orders"))return overrides.missingOrder?null:stripe.recorded;
      if(sql.includes("FROM prepurchase_payment_changes"))return overrides.financialChange?{event_id:"evt_refund"}:null;
      throw new Error("Unrecognized D1 SELECT");
    }};
   }};
  }
 };
 env.DB=db;
 const original=globalThis.fetch;
 const urls=[];
 globalThis.fetch=async(url,config)=>{
   urls.push(String(url));
   if(!String(url).startsWith("https://api.stripe.com/v1/")||
      config?.method!=="GET" || config?.headers?.Authorization!=="Bearer "+env.STRIPE_TEST_SECRET_KEY)
     throw new Error("Unexpected provider request");
   const path=new URL(String(url)).pathname;
   let result;
   if(path.endsWith("/line_items"))result=stripe.lineItems;
   else if(path.includes("/checkout/sessions/"))result=stripe.session;
   else if(path.includes("/payment_intents/"))result=stripe.intent;
   else if(path.includes("/charges/"))result=stripe.charge;
   else throw new Error("Unexpected URL");
   return new Response(JSON.stringify(result),{status:200});
 };
 try{
  const proof=overrides.proof??buyerProof(env,overrides.proofClaims);
  if(overrides.mutateProof)overrides.mutateProof(proof);
  const result=await prepareSignedTestPurchaseAttestation(env,orderId,proof,now);
  return {result,env,queries,urls};
 } finally{
  globalThis.fetch=original;
 }
}
test("default-disabled producer never touches DB/network",async()=>{
 const origFetch=globalThis.fetch;let hits=0;
 globalThis.fetch=async()=>{hits++;throw new Error("unexpected network")};
 try{
  await assert.rejects(()=>prepareSignedTestPurchaseAttestation({...envBase(),PURCHASE_ATTESTATION_MODE:"disabled"},orderId,buyerProof(envBase()),now),/disabled/);
  assert.equal(hits,0);
 } finally{globalThis.fetch=origFetch}
});
test("fresh verified TEST payment and independently signed contact+account proof produce app-compatible HMAC",async()=>{
 const {result,env,queries,urls}=await call();
 assert.equal(verifiedAppConsumer(result,env),true);
 assert.equal(result.purchase.offer,"monthly");
 assert.equal(result.purchase.subtotalCents,999);
 assert.equal(result.purchase.status,"paid_unfulfilled");
 assert.equal(result.purchase.termsAccepted,true);
 assert.equal(result.purchase.verifiedOwnerId,verifiedOwner);
 assert.equal(result.purchase.buyerProofMethod,"independent_mailbox_and_account_control");
 assert.equal(result.purchase.refundOrDisputeOpen,false);
 assert.equal(result.purchase.expiresAt-result.purchase.issuedAt,120);
 assert.equal(queries.length,2);
 assert.equal(urls.length,4);
 assert.equal(JSON.stringify(result).includes(buyer),false);
 assert.equal(JSON.stringify(result).includes(env.PURCHASE_ATTESTATION_HMAC_SECRET),false);
 assert.equal(result.signature,sign(env.PURCHASE_ATTESTATION_HMAC_SECRET,canonicalPurchaseAttestation(result.purchase)));
});
test("annual prepay is signed with correct amount and original 12-month offer",async()=>{
 const {result,env}=await call({annual:true});
 assert.equal(result.purchase.offer,"annual");
 assert.equal(result.purchase.subtotalCents,9600);
 assert.equal(result.purchase.totalCents,9660);
 assert.equal(verifiedAppConsumer(result,env),true);
});
test("refunded/disputed or unreconciled ledger cannot sign",async()=>{
 for(const opts of [
  {financialChange:true},
  {missingOrder:true},
  {modifyStripe:x=>{x.charge.amount_refunded=1}},
  {modifyStripe:x=>{x.charge.disputed=true}},
  {modifyStripe:x=>{x.charge.refunded=true}},
  {modifyStripe:x=>{x.intent.status="requires_payment_method"}},
  {modifyStripe:x=>{x.session.payment_status="unpaid"}},
  {modifyStripe:x=>{x.session.livemode=true}},
  {modifyStripe:x=>{x.lineItems.data[0].price.recurring={interval:"month"}}},
  {modifyStripe:x=>{x.recorded.term="annual"}},
  {modifyStripe:x=>{x.recorded.total_cents=100}},
 ]) await assert.rejects(()=>call(opts));
});
test("missing, altered, expired, wrong-account, wrong-order independent buyer proof is refused",async()=>{
 for(const proofClaims of [
  {verifiedOwnerId:"22222222-2222-4222-8222-222222222222",orderReference:"cs_test_Different"},
  {buyerContactHmac:"c".repeat(64)},
  {buyerProofDigest:"xyz"},
  {expiresAt:now-1},
  {expiresAt:now+121},
  {issuedAt:now-121},
  {verifiedOwnerId:"mail@example.invalid"},
  {issuer:"claimed-by-customer"}
 ]) await assert.rejects(()=>call({proofClaims}));
 await assert.rejects(()=>call({mutateProof:proof=>{proof.signature="0".repeat(64)}}));
 await assert.rejects(()=>call({mutateProof:proof=>{proof.proof.verifiedOwnerId=verifiedOwner==="x"?"y":"22222222-2222-4222-8222-222222222222"}}));
});
test("Stripe checkout email mismatch and removed signed proof fail closed",async()=>{
 await assert.rejects(()=>call({modifyStripe:x=>{x.session.customer_email="different@example.invalid"}}));
 await assert.rejects(()=>call({modifyStripe:x=>{x.session.customer_email=null;x.session.customer_details.email=null}}));
 await assert.rejects(()=>call({proof:null,mutateProof:proof=>{proof.proof.issuer="fake"}}));
});
test("weak, missing, or reused secrets are forbidden",async()=>{
 for(const env of [
  {PURCHASE_ATTESTATION_HMAC_SECRET:"short"},
  {INDEPENDENT_BUYER_PROOF_HMAC_SECRET:""},
  {PURCHASER_CONTACT_HMAC_SECRET:"weak"},
  {INDEPENDENT_BUYER_PROOF_HMAC_SECRET:envBase().PURCHASE_ATTESTATION_HMAC_SECRET},
  {PAYMENTS_MODE:"production"}, {TERMS_APPROVED:"false"},
  {TERMS_VERSION:"UNAPPROVED"}
 ]) await assert.rejects(()=>call({env}));
});
test("tampering with returned signed amount, account, or tax fails app-compatible signature",async()=>{
 const {result,env}=await call();
 for(const changes of [
  {totalCents:999},{verifiedOwnerId:"22222222-2222-4222-8222-222222222222"},
  {refundOrDisputeOpen:true},{termsAccepted:false},{priceId:"price_Other"}
 ]) assert.equal(verifiedAppConsumer({purchase:{...result.purchase,...changes},signature:result.signature},env),false);
});
