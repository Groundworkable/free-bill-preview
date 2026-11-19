/**
 * UNROUTED / UNDEPLOYED / TEST-ONLY internal buyer-proof -> payment attestation handler.
 *
 * No payment Worker fetch route imports this file. A future separate review must
 * explicitly authorize its TEST-only routing and secret setup. This module may
 * NEVER be used as a public checkout, customer endpoint, or paid-access issuer.
 * Payments mode MUST remain disabled.
 */
import {prepareSignedTestPurchaseAttestation} from "./purchase_attestation_producer.draft.mjs";

const ENDPOINT="/internal/test-prepurchase-attestation";
const ORIGIN="https://groundwork-payment-sandbox-isolated.groundworkbyable.workers.dev";
const MAX_BYTES=16384;
const BODY_ORDER=/^cs_test_[A-Za-z0-9]+$/;
const TOKEN=/^gwti_[A-Za-z0-9_-]{48,128}$/;
const HEX64=/^[a-f0-9]{64}$/;
const REQUEST_VERSION="gw-test-transport-v1";
const MAX_CLOCK_SKEW=30;
const encoder=new TextEncoder();
async function signRequest(secret,raw,stamp,nonce){
  const canonical=JSON.stringify([
    REQUEST_VERSION,"POST",ENDPOINT,stamp,nonce,raw
  ]);
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(canonical)));
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
function equalHex(a,b){
  if(!HEX64.test(a||"")||!HEX64.test(b||""))return false;
  let diff=0;
  for(let i=0;i<64;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
const noCache={"Cache-Control":"no-store","Content-Type":"text/plain; charset=utf-8"};
function response(status,text) {
  return new Response(text,{status,headers:noCache});
}
function safeTokenMatches(supplied,expected) {
  // Equal-length constant-work compare after a fixed token format check.
  if(!TOKEN.test(expected||"")||typeof supplied!=="string"||
     supplied.length>160) return false;
  const actual=supplied.startsWith("Bearer ")?supplied.slice(7):"";
  if(!TOKEN.test(actual)||actual.length!==expected.length) return false;
  let diff=0;
  for(let i=0;i<expected.length;i++) diff|=actual.charCodeAt(i)^expected.charCodeAt(i);
  return diff===0;
}
function authorizedEnv(env) {
  return env?.PURCHASE_ATTESTATION_TRANSPORT_MODE==="founder_test_only" &&
    env?.PURCHASE_ATTESTATION_MODE==="sandbox_verified_buyer_only" &&
    env?.PAYMENTS_MODE==="disabled" &&
    env?.PURCHASE_ATTESTATION_REQUEST_AUTH_MODE==="signed_test_only" &&
    TOKEN.test(env?.PURCHASE_ATTESTATION_INTERNAL_TOKEN||"") &&
    typeof env?.PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET==="string" &&
    env.PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET.length>=32 &&
    env.PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET!==env.PURCHASE_ATTESTATION_INTERNAL_TOKEN &&
    env.PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET!==env.INDEPENDENT_BUYER_PROOF_HMAC_SECRET &&
    env.PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET!==env.PURCHASE_ATTESTATION_HMAC_SECRET &&
    env.PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET!==env.PURCHASER_CONTACT_HMAC_SECRET;
}
/**
 * An explicit deployment integration must call this only after validating
 * hostname and HTTPS at its boundary. There is no exported fetch handler.
 *
 * The injected signer is for isolated tests only; production integration
 * should always use the default imported Stripe/D1 verifier.
 */
export async function handleDraftInternalPurchaseAttestation(
  request,env,issue=prepareSignedTestPurchaseAttestation
) {
  if(!authorizedEnv(env))return response(503,"Attestation disabled");
  if(!(request instanceof Request))return response(400,"Invalid request");
  const url=new URL(request.url);
  if(url.pathname!==ENDPOINT || url.search || url.username || url.password ||
     url.origin!==ORIGIN)return response(404,"Not found");
  if(request.method!=="POST")return response(405,"Method not allowed");
  if(!safeTokenMatches(request.headers.get("authorization"),
       env.PURCHASE_ATTESTATION_INTERNAL_TOKEN))
    return response(401,"Unauthorized");
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
        request.headers.get("content-type")||""))
    return response(415,"Unsupported media type");
  // A bearer token by itself cannot authorize a payment lookup. Require a
  // separate HMAC of the EXACT body + method/path + fresh timestamp/nonce.
  // Freshness narrows replay but does not provide nonce persistence; a
  // replay ledger or independent Cloudflare Access gate is required before
  // exposing this as a remotely routed endpoint.
  const stamp=request.headers.get("x-groundwork-test-timestamp");
  const nonce=request.headers.get("x-groundwork-test-nonce");
  const signature=request.headers.get("x-groundwork-test-signature");
  const parsed=Number(stamp);
  if(!stamp||!/^\d{10}$/.test(stamp)||!Number.isSafeInteger(parsed)||
     Math.abs(Math.floor(Date.now()/1000)-parsed)>MAX_CLOCK_SKEW||
     !HEX64.test(nonce||"")||!HEX64.test(signature||""))
    return response(401,"Unauthorized");
  const declared=request.headers.get("content-length");
  if(declared!==null && (!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES))
    return response(413,"Request too large");
  // The body length header can be absent or dishonest. Bound streamed bytes
  // *before* allocating/decoding them, including chunked transfer bodies.
  let payload;
  try {
    if(!request.body)return response(400,"Invalid request");
    const reader=request.body.getReader();
    const chunks=[];
    let total=0;
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_BYTES){
        await reader.cancel().catch(()=>{});
        return response(413,"Request too large");
      }
      chunks.push(value);
    }
    const bytes=new Uint8Array(total);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
    const expected=await signRequest(
      env.PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET,raw,stamp,nonce);
    if(!equalHex(expected,signature))return response(401,"Unauthorized");
    payload=JSON.parse(raw);
  } catch {return response(400,"Invalid request");}
  if(!payload||typeof payload!=="object"||Array.isArray(payload)||
     Object.keys(payload).sort().join(",")!=="buyerProof,sessionId"||
     !BODY_ORDER.test(payload.sessionId||"")||
     !payload.buyerProof||typeof payload.buyerProof!=="object"||
     Array.isArray(payload.buyerProof))
    return response(400,"Invalid request");
  try {
    const envelope=await issue(env,payload.sessionId,payload.buyerProof);
    // No customer email, OTP or raw access credential is in this response.
    return new Response(JSON.stringify(envelope),{
      status:200,
      headers:{"Content-Type":"application/json; charset=utf-8",
        "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"},
    });
  } catch {
    // Deliberately do not leak Stripe data, D1 rows, internal errors or proof.
    return response(503,"Attestation unavailable");
  }
}
