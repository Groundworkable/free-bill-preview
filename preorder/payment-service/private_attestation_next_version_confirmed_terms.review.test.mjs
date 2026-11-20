/**
 * SOURCE-ONLY tests. No Cloudflare, D1, Stripe, secret reads, uploads, deploys,
 * sends, or membership operations. NEVER authorize a version upload.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=dirname(fileURLToPath(import.meta.url));
const read=(name)=>JSON.parse(readFileSync(resolve(root,name),"utf8")
  .split("\n").filter(line=>!line.trimStart().startsWith("//")).join("\n"));
const candidate=read("wrangler.private-attestation.next-version.REVIEW_ONLY_DO_NOT_DEPLOY.jsonc");
const original=read("wrangler.private-attestation.provisioned-inert.DRAFT_DO_NOT_DEPLOY.jsonc");
const exactOffers={
  MONTH_LINK_ID:"plink_1UbK33JK9stEim4w7BvY2CnM",
  ANNUAL_LINK_ID:"plink_1UbK3MJK9stEim4w2nS3loNW",
  MONTH_PRICE_ID:"price_1UbK2YJK9stEim4wCsZ0tyao",
  ANNUAL_PRICE_ID:"price_1UbK2aJK9stEim4wgnY5LRVR"
};
const modes=["PAYMENTS_MODE","PURCHASE_ATTESTATION_ENTRY_MODE",
  "PURCHASE_ATTESTATION_TRANSPORT_MODE","PURCHASE_ATTESTATION_MODE",
  "PURCHASE_ATTESTATION_REQUEST_AUTH_MODE","PURCHASE_ATTESTATION_REPLAY_MODE",
  "PURCHASE_ATTESTATION_ACCESS_MODE"];
const secrets=["STRIPE_TEST_SECRET_KEY","PURCHASE_ATTESTATION_ACCESS_AUD",
  "PURCHASE_ATTESTATION_INTERNAL_TOKEN","PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET",
  "INDEPENDENT_BUYER_PROOF_HMAC_SECRET","PURCHASE_ATTESTATION_HMAC_SECRET",
  "PURCHASER_CONTACT_HMAC_SECRET"];
test("candidate matches ONLY the separate preexisting private TEST worker",()=>{
  assert.equal(candidate.name,"groundwork-private-attestation-test");
  assert.notEqual(candidate.name,"groundwork-payment-sandbox-isolated");
  assert.equal(candidate.main,"./private_attestation_entry.DRAFT_DO_NOT_DEPLOY.mjs");
  assert.equal(candidate.workers_dev,true);
  assert.equal(candidate.preview_urls,false);
  assert.deepEqual(candidate.routes,[]);
  assert.deepEqual(candidate.d1_databases,original.d1_databases);
  assert.equal(candidate.d1_databases[0].database_id,
    "f37839b6-3ed4-4a73-89d7-b6cd6aef6125");
  assert.equal(candidate.vars.PURCHASE_ATTESTATION_PRIVATE_ORIGIN,
    original.vars.PURCHASE_ATTESTATION_PRIVATE_ORIGIN);
});
test("recorded original TEST offer and Terms values do not activate any mode",()=>{
  for(const mode of modes){
    assert.equal(candidate.vars[mode],"disabled");
    assert.equal(original.vars[mode],"disabled");
  }
  assert.equal(candidate.vars.TERMS_VERSION,"prepurchase-v2026-11-17");
  assert.equal(candidate.vars.TERMS_APPROVED,"true");
  for(const [name,value] of Object.entries(exactOffers))
    assert.equal(candidate.vars[name],value);
  assert.equal(Object.keys(candidate.vars).length,Object.keys(original.vars).length+6);
});
test("secrets remain OUT of source and no authorizing mode or deployment is added",()=>{
  for(const secret of secrets)
    assert.equal(Object.hasOwn(candidate.vars,secret),false);
  for(const disallowed of ["STRIPE_LIVE_SECRET_KEY","GROUNDWORK_PREPURCHASE_SUPABASE_SERVICE_ROLE_KEY",
    "PURCHASE_ATTESTATION_ACCESS_CLIENT_SECRET","PURCHASE_ATTESTATION_ACCESS_CLIENT_ID"])
    assert.equal(Object.hasOwn(candidate.vars,disallowed),false);
  assert.equal(candidate.routes.length,0);
  assert.equal(candidate.preview_urls,false);
});
