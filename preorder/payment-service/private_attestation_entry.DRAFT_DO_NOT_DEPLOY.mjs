/**
 * DRAFT ONLY. NOT DEPLOYED OR REFERENCED BY EXISTING PAYMENT WORKER.
 *
 * Separate, private future Worker entry for TEST-only purchase attestation.
 * This module must not be merged into worker.mjs or silently served next to
 * Stripe webhooks. A real deployment requires separate approval, a validated
 * Access Service Auth-only policy on the exact hostname/path, remote D1 nonce
 * migration, reviewed secrets and configured runtime ctx.access.
 */
import {handleDraftInternalPurchaseAttestation} from "./purchase_attestation_transport.draft.mjs";
import {prepareSignedTestPurchaseAttestation} from "./purchase_attestation_producer.draft.mjs";

const ORIGIN="https://groundwork-payment-sandbox-isolated.groundworkbyable.workers.dev";
const PATH="/internal/test-prepurchase-attestation";
const NO_STORE={"Cache-Control":"no-store","Content-Type":"text/plain; charset=utf-8"};

/**
 * Only a new, separately reviewed Worker fetch entry may call this. The
 * supplied ctx must be the actual Cloudflare runtime ctx for the DIRECT
 * Access-authenticated invocation, not an object derived from request data.
 *
 * Injection of issue is exclusively for self-contained tests; the actual
 * draft default entry below binds the real verifier.
 */
export function createDraftAttestationEntryForTest(issue){
  return {
    async fetch(request,env,ctx){
      // Strictly default-OFF even before touching request data or D1.
      if(env?.PURCHASE_ATTESTATION_ENTRY_MODE!=="founder_test_only"||
         env?.PAYMENTS_MODE!=="disabled")
        return new Response("Not available",{status:503,headers:NO_STORE});
      if(!(request instanceof Request))
        return new Response("Invalid request",{status:400,headers:NO_STORE});
      const u=new URL(request.url);
      if(u.origin!==ORIGIN||u.pathname!==PATH||u.search||
         u.username||u.password)
        return new Response("Not found",{status:404,headers:NO_STORE});
      // Deliberately NO Stripe webhook routing. /webhooks/stripe, sign-in,
      // paid enrollment and every other path remain unavailable.
      return handleDraftInternalPurchaseAttestation(
        request,env,issue,ctx?.access
      );
    }
  };
}

/**
 * A stand-alone future entry (still never deployed). Do not import this into
 * the existing webhook Worker: webhook handling has different authentication.
 */
export default createDraftAttestationEntryForTest(
  prepareSignedTestPurchaseAttestation
);
