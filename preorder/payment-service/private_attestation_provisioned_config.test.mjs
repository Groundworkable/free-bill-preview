import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(readFileSync(resolve(root,
  "wrangler.private-attestation.provisioned-inert.DRAFT_DO_NOT_DEPLOY.jsonc"),"utf8")
  .replace(/^\s*\/\/.*$/gm,""));
test("review-only config matches provisioned separate private Worker, never old webhook Worker",()=>{
  assert.equal(config.name,"groundwork-private-attestation-test");
  assert.notEqual(config.name,"groundwork-payment-sandbox-isolated");
  assert.equal(config.main,"./private_attestation_entry.DRAFT_DO_NOT_DEPLOY.mjs");
  assert.equal(config.workers_dev,true);
  assert.deepEqual(config.routes,[]);
  assert.deepEqual(config.d1_databases,[{
    binding:"DB",
    database_name:"groundwork-payment-sandbox-isolated",
    database_id:"f37839b6-3ed4-4a73-89d7-b6cd6aef6125"
  }]);
  assert.equal(config.vars.PURCHASE_ATTESTATION_PRIVATE_ORIGIN,
    "https://groundwork-private-attestation-test.groundworkbyable.workers.dev");
  for(const flag of [
    "PAYMENTS_MODE","PURCHASE_ATTESTATION_ENTRY_MODE",
    "PURCHASE_ATTESTATION_TRANSPORT_MODE","PURCHASE_ATTESTATION_MODE",
    "PURCHASE_ATTESTATION_REQUEST_AUTH_MODE","PURCHASE_ATTESTATION_REPLAY_MODE",
    "PURCHASE_ATTESTATION_ACCESS_MODE"
  ])assert.equal(config.vars[flag],"disabled");
  for(const field of [
    "STRIPE_TEST_SECRET_KEY","STRIPE_LIVE_SECRET_KEY","PURCHASE_ATTESTATION_ACCESS_AUD",
    "PURCHASE_ATTESTATION_HMAC_SECRET","PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET",
    "PURCHASE_ATTESTATION_INTERNAL_TOKEN","INDEPENDENT_BUYER_PROOF_HMAC_SECRET",
    "PURCHASER_CONTACT_HMAC_SECRET","PURCHASE_ATTESTATION_ACCESS_CLIENT_SECRET",
    "PURCHASE_ATTESTATION_ACCESS_CLIENT_ID"
  ])assert.equal(Object.hasOwn(config.vars,field),false);
});
