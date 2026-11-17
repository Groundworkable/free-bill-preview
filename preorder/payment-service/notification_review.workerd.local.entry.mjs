/**
 * LOCAL WORKERD ONLY. D1 transaction/trigger harness, never deploy.
 * No payment network fetch, notification sender, email address or user route.
 * All routes are /__test/* and are prohibited in the actual Worker.
 */
import { isolatedD1ReviewStore } from "./notification_reviewer.draft.mjs";

const cases=Object.freeze({
  good:{key:"gwn1_"+"a".repeat(64),session:"cs_test_ReviewWorkerdGood"},
  blocked:{key:"gwn1_"+"b".repeat(64),session:"cs_test_ReviewWorkerdBlocked"},
  mismatch:{key:"gwn1_"+"c".repeat(64),session:"cs_test_ReviewWorkerdMismatch"},
});
const stamp="2026-11-15T12:00:00.000Z";
function evidence(which) {
  const x=cases[which];
  return {
    notification_key:x.key,
    checkout_session_id:x.session,
    notice_type:"purchase_confirmation",
    notice_ref:which==="mismatch"?"FORGED_IN_TEST":"purchase",
    recipient_hmac:"f".repeat(64),
    reviewer_hmac:"a".repeat(64),
    provider_proof_hmac:"b".repeat(64),
    reviewed_at:stamp,
    authorization_seal:"c".repeat(64),
  };
}
async function installSchema(db,script) {
  // Same complete-statement parser as existing local Workerd fixture.
  const pending=[];
  let inTrigger=false;
  for(const raw of script.split(/\r?\n/)) {
    const line=raw.trim();
    if(!line||line.startsWith("--"))continue;
    if(/^CREATE\s+TRIGGER\b/i.test(line))inTrigger=true;
    pending.push(line);
    if(!(line.endsWith(";")&&(!inTrigger||/^END\s*;$/i.test(line))))continue;
    await db.prepare(pending.join(" ")).run();
    pending.length=0;
    inTrigger=false;
  }
  if(pending.length)throw Error("Incomplete local schema");
}
async function seed(db) {
  for(const [name,x] of Object.entries(cases)) {
    await db.prepare(`INSERT INTO prepurchase_orders
      (checkout_session_id,payment_intent_id,payment_link_id,stripe_price_id,
       term,terms_version,subtotal_cents,tax_cents,total_cents,currency,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(x.session,"pi_ReviewWorkerd"+name,"plink_FAKE_REVIEW_ONLY",
      "price_FAKE_REVIEW_ONLY","monthly","prepurchase-v2026-11-15",
      999,0,999,"usd","paid_unfulfilled").run();
    await db.prepare(`INSERT INTO prepurchase_notification_outbox
      (notification_key,checkout_session_id,notice_type,notice_ref,
       recipient_hmac,template_alias) VALUES (?,?,?,?,?,?)`
    ).bind(x.key,x.session,"purchase_confirmation","purchase",
      "f".repeat(64),"groundwork-prepurchase-confirmation-review").run();
  }
  // Test-only fault injection: ensure D1.batch rolls back an inserted proof
  // when its subsequent UPDATE is refused by another trigger.
  await db.prepare(`CREATE TRIGGER test_only_block_review_completion
    BEFORE UPDATE OF state ON prepurchase_notification_outbox
    WHEN NEW.notification_key='${cases.blocked.key}'
      AND NEW.state='review_verified'
    BEGIN SELECT RAISE(ABORT,'test-only approval transaction refused'); END;`).run();
}
async function report(db) {
  const out={};
  for(const [name,x] of Object.entries(cases)) {
    const row=await db.prepare(
      "SELECT state,review_completed_at FROM prepurchase_notification_outbox WHERE notification_key=?"
    ).bind(x.key).first();
    const proof=await db.prepare(
      "SELECT notification_key,reviewed_at,authorization_seal FROM prepurchase_notification_review_evidence WHERE notification_key=?"
    ).bind(x.key).first();
    const journal=await db.prepare(
      "SELECT old_state,new_state FROM prepurchase_notification_state_journal WHERE notification_key=? ORDER BY id"
    ).bind(x.key).all();
    out[name]={row,proof,journal:journal.results.map(v=>[v.old_state,v.new_state])};
  }
  out.eventCount=(await db.prepare("SELECT COUNT(*) AS count FROM stripe_processed_events").first()).count;
  return out;
}
export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(path==="/__test/review/init"&&request.method==="POST") {
      await installSchema(env.DB,env.__TEST_SCHEMA);
      await seed(env.DB);
      return Response.json({ok:true});
    }
    if(path==="/__test/review/status"&&request.method==="GET") {
      return Response.json(await report(env.DB));
    }
    if(path==="/__test/review/unauthorized"&&request.method==="POST") {
      try {
        await env.DB.prepare(
          "UPDATE prepurchase_notification_outbox SET state='review_verified',review_completed_at=? WHERE notification_key=?"
        ).bind(stamp,cases.good.key).run();
        return Response.json({blocked:false});
      } catch{return Response.json({blocked:true});}
    }
    if(path==="/__test/review/approve"&&request.method==="POST") {
      const {scenario}=await request.json();
      if(!Object.hasOwn(cases,scenario))return Response.json({invalid:true},{status:400});
      try {
        const succeeded=await isolatedD1ReviewStore(env.DB).approve(evidence(scenario));
        return Response.json({succeeded});
      }catch{return Response.json({succeeded:false,batchFailed:true});}
    }
    if(path==="/__test/review/immutability"&&request.method==="POST") {
      let updated=false,deleted=false;
      try {
        await env.DB.prepare("UPDATE prepurchase_notification_review_evidence SET reviewed_at=? WHERE notification_key=?")
          .bind("2027-01-01T00:00:00.000Z",cases.good.key).run();
        updated=true;
      }catch{}
      try {
        await env.DB.prepare("DELETE FROM prepurchase_notification_review_evidence WHERE notification_key=?")
          .bind(cases.good.key).run();
        deleted=true;
      }catch{}
      return Response.json({updateBlocked:!updated,deleteBlocked:!deleted});
    }
    return new Response("Not found",{status:404});
  }
};
