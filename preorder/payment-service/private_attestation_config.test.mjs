import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=dirname(fileURLToPath(import.meta.url));
const original=readFileSync(resolve(root,"wrangler.private-attestation.DRAFT_DO_NOT_DEPLOY.jsonc"),"utf8");
const webhook=JSON.parse(
  readFileSync(resolve(root,"wrangler.sandbox.example.jsonc"),"utf8")
    .replace(/^\s*\/\/.*$/gm,"")
);
const config=JSON.parse(original.replace(/^\s*\/\/.*$/gm,""));

test("future Worker config is a separate inert candidate, not a webhook takeover",()=>{
  assert.notEqual(config.name,webhook.name);
  assert.equal(config.name,"groundwork-private-attestation-test");
  assert.equal(config.main,"./private_attestation_entry.DRAFT_DO_NOT_DEPLOY.mjs");
  assert.equal(config.workers_dev,false);
  assert.deepEqual(config.routes,[]);
  assert.equal(config.vars.PAYMENTS_MODE,"disabled");
  assert.equal(config.vars.PURCHASE_ATTESTATION_ENTRY_MODE,"disabled");
  assert.equal(config.vars.PURCHASE_ATTESTATION_TRANSPORT_MODE,"disabled");
  assert.equal(config.vars.PURCHASE_ATTESTATION_MODE,"disabled");
  assert.equal(config.vars.PURCHASE_ATTESTATION_REQUEST_AUTH_MODE,"disabled");
  assert.equal(config.vars.PURCHASE_ATTESTATION_REPLAY_MODE,"disabled");
  assert.equal(config.vars.PURCHASE_ATTESTATION_ACCESS_MODE,"disabled");
  assert.equal(config.vars.PURCHASE_ATTESTATION_PRIVATE_ORIGIN,"UNCONFIGURED");
  assert.equal(config.d1_databases,undefined);
  assert.equal(config.triggers,undefined);
  assert.equal(config.tail_consumers,undefined);
  assert.equal(config.queues,undefined);
});
test("no credentials or accidental live bindings are embedded in candidate",()=>{
  const text=JSON.stringify(config);
  for(const key of [
    "STRIPE_TEST_SECRET_KEY","STRIPE_LIVE_SECRET_KEY","API_TOKEN",
    "PURCHASE_ATTESTATION_ACCESS_CLIENT_SECRET",
    "PURCHASE_ATTESTATION_HMAC_SECRET",
    "INDEPENDENT_BUYER_PROOF_HMAC_SECRET",
    "PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET",
    "PURCHASE_ATTESTATION_INTERNAL_TOKEN",
    "D1_DATABASE_ID","account_id","route","zone_id"
  ]) {
    if(key==="route")continue;
    assert.equal(Object.prototype.hasOwnProperty.call(config.vars,key),false);
    assert.equal(text.includes('"'+key+'":'),false);
  }
});
