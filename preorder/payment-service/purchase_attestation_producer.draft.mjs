/**
 * TEST-ONLY payment-side producer for App PR #38's signed attestation consumer.
 * DRAFT ONLY: not routed, deployed, enabled, called by webhook, or sent anywhere.
 *
 * Independently retrieves Stripe TEST Checkout, line items, PaymentIntent,
 * charge; matches the immutable isolated D1 order, blocks known refund/dispute
 * changes, and requires a SEPARATE independently signed buyer mailbox + app
 * account proof. That trusted buyer-proof issuer DOES NOT YET EXIST.
 * A checkout email, receipt, unverified boolean or account name is never proof.
 * No customer email, raw proof, signature secret or card data is stored.
 */
import { verifyPaidPurchase } from "./worker.mjs";
const enc=new TextEncoder();
const HEX64=/^[a-f0-9]{64}$/;
const TEST=/^cs_test_[A-Za-z0-9]+$/;
const CHARGE=/^ch_[A-Za-z0-9]+$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMS=/^prepurchase-v\d{4}-\d{2}-\d{2}$/;
const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PROOF_VERSION="gw-independent-buyer-proof-test-v1";
async function hmac(secret,message){
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(message)));
  return Array.from(signed,b=>b.toString(16).padStart(2,"0")).join("");
}
function equal(a,b) {
  if(!HEX64.test(a||"")||!HEX64.test(b||""))return false;
  let n=0;for(let i=0;i<64;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);
  return n===0;
}
function normalizedEmail(v) {
  if(typeof v!=="string"||v.length>254)return null;
  const s=v.trim().toLowerCase();
  return EMAIL.test(s)?s:null;
}
/** Exact canonical field list and order accepted by app PR #38. */
export function canonicalPurchaseAttestation(p){
  return JSON.stringify([
    p.version,p.issuer,p.orderReference,p.paymentIntent,p.priceId,
    p.offer,p.subtotalCents,p.taxCents,p.totalCents,p.termsVersion,
    p.verifiedOwnerId,p.buyerProofDigest,p.buyerProofMethod,p.status,
    p.termsAccepted,p.refundOrDisputeOpen,p.issuedAt,p.expiresAt,p.nonce
  ]);
}
export function canonicalIndependentBuyerProof(p){
  return JSON.stringify([
    p.version,p.issuer,p.orderReference,p.verifiedOwnerId,
    p.buyerContactHmac,p.buyerProofDigest,p.issuedAt,p.expiresAt,p.nonce
  ]);
}
// First authenticate the signed app-account/mailbox proof BEFORE any Stripe
// or D1 lookup. Contact matching necessarily follows Stripe Checkout fetch.
async function verifyIndependentBuyerProofSignature(env,envelope,sessionId,now){
  const p=envelope?.proof;
  if(!p||p.version!==PROOF_VERSION||
     p.issuer!=="groundwork-verified-identity-service"||
     !TEST.test(p.orderReference||"")||p.orderReference!==sessionId||
     !UUID.test(p.verifiedOwnerId||"")||
     !HEX64.test(p.buyerContactHmac||"")||
     !HEX64.test(p.buyerProofDigest||"")||
     !HEX64.test(p.nonce||"")||
     !Number.isSafeInteger(p.issuedAt)||
     !Number.isSafeInteger(p.expiresAt)||
     p.issuedAt>now+30||p.issuedAt<now-120||
     p.expiresAt<=now||p.expiresAt>p.issuedAt+120||
     !HEX64.test(envelope?.signature||"")) {
    throw new Error("Independent buyer proof unavailable");
  }
  const expected=await hmac(env.INDEPENDENT_BUYER_PROOF_HMAC_SECRET,
    canonicalIndependentBuyerProof(p));
  if(!equal(expected,envelope.signature))
    throw new Error("Buyer proof not authenticated");
  return p;
}
async function verifyIndependentBuyerContact(env,proof,session) {
  const detail=normalizedEmail(session.customer_details?.email);
  const supplied=normalizedEmail(session.customer_email);
  if(!detail&&!supplied)throw new Error("Checkout buyer email not verified");
  if(detail&&supplied&&detail!==supplied)throw new Error("Checkout buyer email mismatch");
  const contactHmac=await hmac(env.PURCHASER_CONTACT_HMAC_SECRET,
    "groundwork-stripe-checkout-contact-v1:"+(detail||supplied));
  if(!equal(contactHmac,proof.buyerContactHmac))
    throw new Error("Buyer proof and Stripe contact do not match");
  return proof;
}
function requireEnv(env){
  if(env?.PURCHASE_ATTESTATION_MODE!=="sandbox_verified_buyer_only")
    throw new Error("Purchase attestation disabled");
  // Attest a completed order ONLY while the payment webhook receiver remains
  // OFF. This draft verifies Stripe TEST + immutable D1 via read-only calls;
  // no purchase endpoint, webhook or live charge is enabled for fulfillment.
  if(env.PAYMENTS_MODE!=="disabled"||env.TERMS_APPROVED!=="true"||
     !TERMS.test(env.TERMS_VERSION||"")||
     !env.STRIPE_TEST_SECRET_KEY?.startsWith("sk_test_")||
     !env.DB?.prepare||
     typeof env.PURCHASE_ATTESTATION_HMAC_SECRET!=="string"||
     env.PURCHASE_ATTESTATION_HMAC_SECRET.length<32||
     typeof env.INDEPENDENT_BUYER_PROOF_HMAC_SECRET!=="string"||
     env.INDEPENDENT_BUYER_PROOF_HMAC_SECRET.length<32||
     typeof env.PURCHASER_CONTACT_HMAC_SECRET!=="string"||
     env.PURCHASER_CONTACT_HMAC_SECRET.length<32||
     new Set([
       env.PURCHASE_ATTESTATION_HMAC_SECRET,
       env.INDEPENDENT_BUYER_PROOF_HMAC_SECRET,
       env.PURCHASER_CONTACT_HMAC_SECRET
     ]).size!==3)
    throw new Error("Purchase attestation not configured");
  for(const key of ["MONTH_LINK_ID","ANNUAL_LINK_ID"])
    if(!/^plink_[A-Za-z0-9]+$/.test(env[key]||""))
      throw new Error("Payment link not configured");
  for(const key of ["MONTH_PRICE_ID","ANNUAL_PRICE_ID"])
    if(!/^price_[A-Za-z0-9]+$/.test(env[key]||""))
      throw new Error("Payment price not configured");
}
async function stripeGet(env,path){
  // The draft verifier must never follow an unexpected redirect with
  // a Stripe TEST credential, cache a financial recheck, or wait forever.
  const r=await fetch("https://api.stripe.com/v1/"+path,{
    method:"GET",
    redirect:"error",
    cache:"no-store",
    signal:AbortSignal.timeout(5000),
    headers:{Authorization:"Bearer "+env.STRIPE_TEST_SECRET_KEY}
  });
  if(!r.ok)throw new Error("Stripe verification request failed");
  return r.json();
}
/**
 * Internal-only entry point. Not exposed through worker.fetch, and cannot
 * produce a trusted output without an independent signed mailbox+account
 * challenge proof (that proof service is still to be built and reviewed).
 * No writes, email sends, activation, or live-mode payment changes.
 */
export async function prepareSignedTestPurchaseAttestation(
  env,sessionId,buyerProof,now=Math.floor(Date.now()/1000)
){
  requireEnv(env);
  if(!TEST.test(sessionId||"")||!Number.isSafeInteger(now))
    throw new Error("Unverified TEST purchase request");
  // Invalid, expired or tampered buyer proofs must never trigger provider or
  // database reads. Stripe email control is checked independently below.
  const authenticatedBuyer=await verifyIndependentBuyerProofSignature(
    env,buyerProof,sessionId,now);
  const id=encodeURIComponent(sessionId);
  const [session,itemResponse]=await Promise.all([
    stripeGet(env,"checkout/sessions/"+id),
    stripeGet(env,"checkout/sessions/"+id+"/line_items?limit=2")
  ]);
  if(session.id!==sessionId||itemResponse.has_more!==false||
     !Array.isArray(itemResponse.data))
    throw new Error("Incomplete Stripe verification");
  const offers=[
    {link:env.MONTH_LINK_ID,price:env.MONTH_PRICE_ID,term:"monthly",
      amount:999,termsVersion:env.TERMS_VERSION},
    {link:env.ANNUAL_LINK_ID,price:env.ANNUAL_PRICE_ID,term:"annual",
      amount:9600,termsVersion:env.TERMS_VERSION}
  ];
  const o=verifyPaidPurchase(session,itemResponse.data,offers);
  const intent=await stripeGet(env,"payment_intents/"+encodeURIComponent(o.paymentIntent));
  const chargeId=typeof intent.latest_charge==="string"?intent.latest_charge:null;
  if(intent.id!==o.paymentIntent||intent.livemode!==false||
     intent.status!=="succeeded"||intent.currency!=="usd"||
     intent.amount_received!==o.total||intent.amount!==o.total||
     !CHARGE.test(chargeId||""))
    throw new Error("Payment intent not cleared");
  const charge=await stripeGet(env,"charges/"+encodeURIComponent(chargeId));
  if(charge.id!==chargeId||charge.livemode!==false||
     charge.payment_intent!==o.paymentIntent||
     charge.status!=="succeeded"||charge.paid!==true||
     charge.captured!==true||charge.currency!=="usd"||
     charge.amount!==o.total||charge.amount_refunded!==0||
     charge.refunded!==false||charge.disputed!==false)
    throw new Error("Charge not clear for pending claim");
  const row=await env.DB.prepare(
    "SELECT checkout_session_id,payment_intent_id,stripe_customer_id,"+
    "payment_link_id,stripe_price_id,term,terms_version,subtotal_cents,"+
    "tax_cents,total_cents,currency,status FROM prepurchase_orders "+
    "WHERE checkout_session_id=? LIMIT 1"
  ).bind(o.id).first();
  if(!row||row.checkout_session_id!==o.id||
     row.payment_intent_id!==o.paymentIntent||
     row.stripe_customer_id!==o.customer||
     row.payment_link_id!==o.link||row.stripe_price_id!==o.price||
     row.term!==o.term||row.terms_version!==o.termsVersion||
     row.subtotal_cents!==o.subtotal||row.tax_cents!==o.tax||
     row.total_cents!==o.total||row.currency!==o.currency||
     row.status!=="paid_unfulfilled")
    throw new Error("Immutable D1 order mismatch");
  const change=await env.DB.prepare(
    "SELECT event_id FROM prepurchase_payment_changes "+
    "WHERE payment_intent_id=? OR charge_id=? LIMIT 1"
  ).bind(o.paymentIntent,chargeId).first();
  if(change)throw new Error("Refund/dispute change requires review");

  const proof=await verifyIndependentBuyerContact(env,authenticatedBuyer,session);
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),
    x=>x.toString(16).padStart(2,"0")).join("");
  const purchase=Object.freeze({
    version:"gw-prepurchase-test-v1",
    issuer:"groundwork-isolated-payment-service",
    orderReference:o.id,paymentIntent:o.paymentIntent,priceId:o.price,
    offer:o.term,subtotalCents:o.subtotal,taxCents:o.tax,totalCents:o.total,
    termsVersion:o.termsVersion,verifiedOwnerId:proof.verifiedOwnerId,
    buyerProofDigest:proof.buyerProofDigest,
    buyerProofMethod:"independent_mailbox_and_account_control",
    status:"paid_unfulfilled",termsAccepted:true,refundOrDisputeOpen:false,
    issuedAt:now,expiresAt:now+120,nonce
  });
  return Object.freeze({
    purchase,
    signature:await hmac(env.PURCHASE_ATTESTATION_HMAC_SECRET,
      canonicalPurchaseAttestation(purchase))
  });
}
