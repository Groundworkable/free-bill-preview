/**
 * Native Workerd/D1 transaction tests. No remote D1, provider calls, credentials
 * or live Worker routes. Deliberate /__test/* local-only entrypoint.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTestHarness } from "wrangler";

const prefix=new URL("./",import.meta.url);
const schema=["schema.sql",
  "remote_d1_notification_ledger_additive_migration_2026-11-15.sql",
  "notification_review_evidence.draft.sql"
].map(name=>readFileSync(new URL(name,prefix),"utf8")).join("\n");
const server=createTestHarness({workers:[{
  config:{
    name:"groundwork-review-local-only",
    main:fileURLToPath(new URL("./notification_review.workerd.local.entry.mjs",import.meta.url)),
    compatibility_date:"2026-11-13",
    workers_dev:false,routes:[],
    d1_databases:[{binding:"DB",database_name:"groundwork-review-test-memory",
      database_id:"00000000-0000-0000-0000-000000000002"}],
  },
  vars:{__TEST_SCHEMA:schema},
}]});
const base="https://example.invalid";
async function post(path,body={}) {
  const response=await server.fetch(base+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  assert.equal(response.status,200,`HTTP ${response.status}`);
  return response.json();
}
async function status() {
  const response=await server.fetch(base+"/__test/review/status");
  assert.equal(response.status,200,`HTTP ${response.status}`);
  return response.json();
}
before(async()=>{
  await server.listen();
  assert.deepEqual(await post("/__test/review/init"),{ok:true});
});
after(async()=>await server.close());

test("review_verified cannot be forged without immutable review evidence",async()=>{
  assert.deepEqual(await post("/__test/review/unauthorized"),{blocked:true});
  const s=await status();
  for(const name of ["good","blocked","mismatch"]) {
    assert.equal(s[name].row.state,"review_pending");
    assert.equal(s[name].proof,null);
    assert.deepEqual(s[name].journal,[[null,"review_pending"]]);
  }
  assert.equal(s.eventCount,0);
});

test("native D1 approval batch inserts evidence, changes state, and appends journal",async()=>{
  assert.deepEqual(await post("/__test/review/approve",{scenario:"good"}),{succeeded:true});
  const s=await status();
  assert.equal(s.good.row.state,"review_verified");
  assert.equal(s.good.row.review_completed_at,"2026-11-15T12:00:00.000Z");
  assert.equal(s.good.proof.reviewed_at,s.good.row.review_completed_at);
  assert.equal(s.good.proof.authorization_seal,"c".repeat(64));
  assert.deepEqual(s.good.journal,[
    [null,"review_pending"],["review_pending","review_verified"]
  ]);
  assert.equal(s.eventCount,0);
});

test("native D1 rejects duplicate approval without changing seal or journal",async()=>{
  assert.deepEqual(await post("/__test/review/approve",{scenario:"good"}),{succeeded:false});
  const s=await status();
  assert.equal(s.good.row.state,"review_verified");
  assert.equal(s.good.proof.authorization_seal,"c".repeat(64));
  assert.equal(s.good.journal.length,2);
});

test("native D1 batch rolls back evidence insert when a trigger rejects state change",async()=>{
  assert.deepEqual(await post("/__test/review/approve",{scenario:"blocked"}),{
    succeeded:false,batchFailed:true
  });
  const s=await status();
  assert.equal(s.blocked.row.state,"review_pending");
  assert.equal(s.blocked.row.review_completed_at,null);
  assert.equal(s.blocked.proof,null,"Evidence insert must roll back with rejected UPDATE");
  assert.deepEqual(s.blocked.journal,[[null,"review_pending"]]);
});

test("native D1 rejects evidence identity mismatch and keeps outbox unchanged",async()=>{
  assert.deepEqual(await post("/__test/review/approve",{scenario:"mismatch"}),{
    succeeded:false,batchFailed:true
  });
  const s=await status();
  assert.equal(s.mismatch.row.state,"review_pending");
  assert.equal(s.mismatch.proof,null);
  assert.deepEqual(s.mismatch.journal,[[null,"review_pending"]]);
});

test("native D1 makes review evidence append-only",async()=>{
  assert.deepEqual(await post("/__test/review/immutability"),{
    updateBlocked:true,deleteBlocked:true
  });
  const s=await status();
  assert.equal(s.good.proof.authorization_seal,"c".repeat(64));
  assert.equal(s.eventCount,0);
});

test("test-only entrypoint has no public payment, dispatch, or unrelated routes",async()=>{
  for(const url of ["/","/webhooks/stripe","/founder/notifications/dispatch","/__test/notification/dispatch"]) {
    const res=await server.fetch(base+url,{method:"POST"});
    assert.equal(res.status,404,url);
  }
});
