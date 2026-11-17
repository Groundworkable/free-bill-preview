/**
 * LOCAL WORKERD/D1 HARNESS ONLY. NEVER DEPLOY.
 * Only test helpers live under /__test/*. All actual webhook processing is
 * delegated to the same deployable payment receiver source.
 */
import paymentWorker from "./worker.mjs";

async function installSchema(db,script) {
  const pending=[];
  let inTrigger=false;
  for(const raw of script.split(/\r?\n/)) {
    const line=raw.trim();
    if(!line || line.startsWith("--"))continue;
    if(/^CREATE\s+TRIGGER\b/i.test(line))inTrigger=true;
    pending.push(line);
    if(!(line.endsWith(";")&&(!inTrigger||/^END\s*;$/i.test(line))))continue;
    await db.prepare(pending.join(" ")).run();
    pending.length=0;
    inTrigger=false;
  }
  if(pending.length)throw Error("Incomplete local D1 schema");
}

async function state(db) {
  const counts={};
  for(const [name,table] of Object.entries({
    events:"stripe_processed_events",
    orders:"prepurchase_orders",
    notices:"prepurchase_notification_outbox",
    journal:"prepurchase_notification_state_journal",
    evidence:"prepurchase_notification_review_evidence",
  })) {
    counts[name]=(await db.prepare("SELECT count(*) AS total FROM "+table).first()).total;
  }
  const notices=await db.prepare(
    `SELECT notification_key,checkout_session_id,notice_type,notice_ref,
      recipient_hmac,template_alias,state,review_completed_at,attempt_token,
      provider_message_id FROM prepurchase_notification_outbox
     ORDER BY checkout_session_id`
  ).all();
  const journal=await db.prepare(
    "SELECT old_state,new_state FROM prepurchase_notification_state_journal ORDER BY id"
  ).all();
  const orders=await db.prepare(
    "SELECT checkout_session_id,status FROM prepurchase_orders ORDER BY checkout_session_id"
  ).all();
  return {counts,notices:notices.results,journal:journal.results,orders:orders.results};
}

export default {
  async fetch(request,env,ctx) {
    const path=new URL(request.url).pathname;
    if(path==="/__test/seed"&&request.method==="POST") {
      await installSchema(env.DB,env.__TEST_SCHEMA);
      return Response.json({ok:true});
    }
    if(path==="/__test/state"&&request.method==="GET") {
      return Response.json(await state(env.DB));
    }
    if(path==="/__test/block-outbox"&&request.method==="POST") {
      await env.DB.prepare(`CREATE TRIGGER test_only_abort_pending_outbox
        BEFORE INSERT ON prepurchase_notification_outbox
        WHEN NEW.checkout_session_id='cs_test_Rollback003'
        BEGIN SELECT RAISE(ABORT,'test-only atomic rollback'); END;`).run();
      return Response.json({ok:true});
    }
    if(path.startsWith("/__test/"))return new Response("Not found",{status:404});
    return paymentWorker.fetch(request,env,ctx);
  }
};
