/**
 * SOURCE-ONLY / TEST-ONLY / REVIEW-ONLY. No provider calls, secrets, upload,
 * send, D1 migration, or membership activation. GitHub Actions minutes were
 * exhausted when this test was added; local execution is a separate check.
 *
 * Purpose: assess nonsecret shape of a FUTURE inactive version candidate.
 * Passing NEVER authorizes version upload, traffic deploy, or mode changes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=dirname(fileURLToPath(import.meta.url));
const parseJsonc=(path)=>JSON.parse(
  readFileSync(resolve(root,path),"utf8")
    .split("\n").filter(line=>!line.trimStart().startsWith("//")).join("\n")
);
const inert=parseJsonc("wrangler.private-attestation.provisioned-inert.DRAFT_DO_NOT_DEPLOY.jsonc");
const FLAGS=[
  "PAYMENTS_MODE",
  "PURCHASE_ATTESTATION_ENTRY_MODE",
  "PURCHASE_ATTESTATION_TRANSPORT_MODE",
  "PURCHASE_ATTESTATION_MODE",
  "PURCHASE_ATTESTATION_REQUEST_AUTH_MODE",
  "PURCHASE_ATTESTATION_REPLAY_MODE",
  "PURCHASE_ATTESTATION_ACCESS_MODE",
];
const SECRET_NAMES=[
  "STRIPE_TEST_SECRET_KEY","PURCHASE_ATTESTATION_ACCESS_AUD",
  "PURCHASE_ATTESTATION_INTERNAL_TOKEN","PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET",
  "INDEPENDENT_BUYER_PROOF_HMAC_SECRET","PURCHASE_ATTESTATION_HMAC_SECRET",
  "PURCHASER_CONTACT_HMAC_SECRET",
];
const OFFERS={
  MONTH_LINK_ID:"plink_1UbK33JK9stEim4w7BvY2CnM",
  ANNUAL_LINK_ID:"plink_1UbK3MJK9stEim4w2nS3loNW",
  MONTH_PRICE_ID:"price_1UbK2YJK9stEim4wCsZ0tyao",
  ANNUAL_PRICE_ID:"price_1UbK2aJK9stEim4wgnY5LRVR",
};
const ORIGIN="https://groundwork-private-attestation-test.groundworkbyable.workers.dev";
const D1="f37839b6-3ed4-4a73-89d7-b6cd6aef6125";

/** Nonsecret source shape only: cannot attest to Cloudflare runtime state. */
function inspect(config,{termsVersionIndependentlyConfirmed=false}={}){
  const failures=[];
  const require=(ok,why)=>{if(!ok)failures.push(why)};
  require(config?.name==="groundwork-private-attestation-test","worker");
  require(config?.main==="./private_attestation_entry.DRAFT_DO_NOT_DEPLOY.mjs","entry");
  require(config?.workers_dev===true,"workers_dev");
  require(config?.preview_urls===false,"previews");
  require(Array.isArray(config?.routes)&&config.routes.length===0,"routes");
  require(config?.vars?.PURCHASE_ATTESTATION_PRIVATE_ORIGIN===ORIGIN,"origin");
  require(Array.isArray(config?.d1_databases)&&config.d1_databases.length===1 &&
    config.d1_databases[0]?.binding==="DB" &&
    config.d1_databases[0]?.database_id===D1,"isolated_D1");
  for(const flag of FLAGS)require(config?.vars?.[flag]==="disabled","mode:"+flag);
  const vars=config?.vars??{};
  for(const name of SECRET_NAMES)require(!Object.hasOwn(vars,name),"secret_in_vars:"+name);
  for(const [name,id] of Object.entries(OFFERS))
    require(vars[name]===id,"test_offer:"+name);
  require(vars.TERMS_APPROVED==="true","terms_approval_flag");
  require(/^prepurchase-v\d{4}-\d{2}-\d{2}$/.test(vars.TERMS_VERSION??""),
    "terms_version_format");
  require(termsVersionIndependentlyConfirmed===true,
    "immutable_remote_order_terms_unconfirmed");
  return Object.freeze({
    sourceShapePass:failures.length===0,
    blockers:failures,
    remoteReady:false, // no remote D1/Access/runtime verification here
    permittedToUpload:false,
    permittedToDeploy:false,
    permittedToSendOtp:false,
    permittedToIssueClaim:false,
  });
}

test("existing inactive config is blocked before missing Terms and four offers are reviewed",()=>{
  const result=inspect(inert);
  assert.equal(result.sourceShapePass,false);
  for(const missing of ["terms_approval_flag","terms_version_format",
    "immutable_remote_order_terms_unconfirmed",
    ...Object.keys(OFFERS).map(k=>"test_offer:"+k)])
    assert.ok(result.blockers.includes(missing),missing);
  assert.equal(result.permittedToUpload,false);
});

test("synthetic COMPLETE shape remains OFF and NEVER grants upload authority",()=>{
  // This date is deliberately synthetic; it is NOT an asserted real D1 version.
  const config=structuredClone(inert);
  config.vars={...config.vars,...OFFERS,TERMS_APPROVED:"true",
    TERMS_VERSION:"prepurchase-v2099-12-31"};
  const result=inspect(config,{termsVersionIndependentlyConfirmed:true});
  assert.deepEqual(result.blockers,[]);
  assert.equal(result.sourceShapePass,true);
  assert.equal(result.remoteReady,false);
  assert.equal(result.permittedToUpload,false);
  assert.equal(result.permittedToDeploy,false);
});

test("unverified Terms block even with a complete-looking candidate",()=>{
  const config=structuredClone(inert);
  config.vars={...config.vars,...OFFERS,TERMS_APPROVED:"true",
    TERMS_VERSION:"prepurchase-v2099-12-31"};
  assert.ok(inspect(config).blockers.includes("immutable_remote_order_terms_unconfirmed"));
});

test("mode activation, old Worker, wrong D1, and altered Stripe IDs fail closed",()=>{
  const config=structuredClone(inert);
  config.vars={...config.vars,...OFFERS,TERMS_APPROVED:"true",
    TERMS_VERSION:"prepurchase-v2099-12-31"};
  for(const mutation of [
    x=>{x.vars.PAYMENTS_MODE="sandbox"},
    x=>{x.vars.PURCHASE_ATTESTATION_ENTRY_MODE="founder_test_only"},
    x=>{x.name="groundwork-payment-sandbox-isolated"},
    x=>{x.d1_databases[0].database_id="wrong"},
    x=>{x.vars.MONTH_PRICE_ID="price_wrong"},
    x=>{x.vars.PURCHASE_ATTESTATION_PRIVATE_ORIGIN="https://example.invalid"},
    x=>{x.vars.STRIPE_TEST_SECRET_KEY="rk_test_SHOULD_NOT_BE_IN_VARS"},
  ]){
    const changed=structuredClone(config);
    mutation(changed);
    assert.equal(inspect(changed,{termsVersionIndependentlyConfirmed:true}).sourceShapePass,
      false);
  }
});

test("future entry/producer remain separate from webhook and accept rk_test_ in draft",()=>{
  const entry=readFileSync(resolve(root,
    "private_attestation_entry.DRAFT_DO_NOT_DEPLOY.mjs"),"utf8");
  const producer=readFileSync(resolve(root,
    "purchase_attestation_producer.draft.mjs"),"utf8");
  assert.match(entry,/PURCHASE_ATTESTATION_ENTRY_MODE/);
  assert.match(entry,/OLD_WEBHOOK_ORIGIN/);
  assert.match(producer,/\(\?:sk\|rk\)_test_/);
  assert.match(producer,/checkout\/sessions\//);
  assert.match(producer,/payment_intents\//);
  assert.match(producer,/charges\//);
});
