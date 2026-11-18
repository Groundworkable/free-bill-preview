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
const MAX_BYTES=16384;
const BODY_ORDER=/^cs_test_[A-Za-z0-9]+$/;
const TOKEN=/^gwti_[A-Za-z0-9_-]{48,128}$/;
const encoder=new TextEncoder();
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
    TOKEN.test(env?.PURCHASE_ATTESTATION_INTERNAL_TOKEN||"");
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
     url.protocol!=="https:")return response(404,"Not found");
  if(request.method!=="POST")return response(405,"Method not allowed");
  if(!safeTokenMatches(request.headers.get("authorization"),
       env.PURCHASE_ATTESTATION_INTERNAL_TOKEN))
    return response(401,"Unauthorized");
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
        request.headers.get("content-type")||""))
    return response(415,"Unsupported media type");
  const declared=request.headers.get("content-length");
  if(declared!==null && (!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES))
    return response(413,"Request too large");
  let payload;
  try {
    const body=await request.text();
    if(encoder.encode(body).length>MAX_BYTES)return response(413,"Request too large");
    payload=JSON.parse(body);
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
