/**
 * Test-only entrypoint for the local Workerd/D1 harness.
 * NOT included in the sandbox Worker deployment template.
 */
import paymentWorker from "./worker.mjs";
import { dispatchFounderTestNotification, isolatedD1NotificationStore } from "./notification_sender.sandbox.mjs";
import { stripeTestReadAdapter, resendFounderTestTransport } from "./notification_provider_adapters.sandbox.mjs";
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/__test/seed" && request.method === "POST") {
      // Seed only the local in-memory D1. D1.exec treats newlines as SQL
      // boundaries, so passing a formatted script with comments/trigger
      // bodies fails; naive semicolon splitting also corrupts triggers.
      // Assemble complete statements and run them through D1.prepare.
      let pending = [];
      let trigger = false;
      for (const raw of env.__TEST_SCHEMA.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("--")) continue;
        if (/^CREATE\s+TRIGGER\b/i.test(line)) trigger = true;
        pending.push(line);
        const complete = line.endsWith(";") && (!trigger || /^END\s*;$/i.test(line));
        if (!complete) continue;
        await env.DB.prepare(pending.join(" ")).run();
        pending = [];
        trigger = false;
      }
      if (pending.length) throw new Error("Incomplete local D1 schema");
      return new Response("OK");
    }
    if (url.pathname === "/__test/counts" && request.method === "GET") {
      const orders = await env.DB.prepare("SELECT count(*) AS n FROM prepurchase_orders").first();
      const events = await env.DB.prepare("SELECT count(*) AS n FROM stripe_processed_events").first();
      return Response.json({orders:orders.n,events:events.n});
    }
    if (url.pathname === "/__test/order" && request.method === "GET") {
      const row = await env.DB.prepare("SELECT status,subtotal_cents,tax_cents,total_cents FROM prepurchase_orders LIMIT 1").first();
      return Response.json(row);
    }
    if (url.pathname === "/__test/order-immutability" && request.method === "GET") {
      // Test-only local D1 mutation probe. Never deploy this entrypoint.
      const id = "cs_test_ABC123local";
      const original = await env.DB.prepare(
        "SELECT status,total_cents FROM prepurchase_orders WHERE checkout_session_id=?"
      ).bind(id).first();
      if (!original) return Response.json({error:"Fixture missing"}, {status:409});
      let updateBlocked=false;
      let deleteBlocked=false;
      try {
        await env.DB.prepare(
          "UPDATE prepurchase_orders SET total_cents=999 WHERE checkout_session_id=?"
        ).bind(id).run();
      } catch { updateBlocked=true; }
      try {
        await env.DB.prepare(
          "DELETE FROM prepurchase_orders WHERE checkout_session_id=?"
        ).bind(id).run();
      } catch { deleteBlocked=true; }
      const after = await env.DB.prepare(
        "SELECT status,total_cents FROM prepurchase_orders WHERE checkout_session_id=?"
      ).bind(id).first();
      return Response.json({
        updateBlocked, deleteBlocked,
        orderUnchanged: Boolean(after && after.status===original.status && after.total_cents===original.total_cents)
      });
    }
    if (url.pathname === "/__test/journal-immutability" && request.method === "GET") {
      // Deliberate local-only mutation attempts to test the D1 triggers.
      // This route MUST NEVER appear in the deployable payment Worker.
      const eventId = "evt_RefundDone";
      const before = await env.DB.prepare(
        "SELECT amount_cents FROM prepurchase_payment_changes WHERE event_id = ?"
      ).bind(eventId).first();
      if (!before) return Response.json({error:"Fixture missing"}, {status:409});
      let updateBlocked = false;
      let deleteBlocked = false;
      try {
        await env.DB.prepare(
          "UPDATE prepurchase_payment_changes SET amount_cents = 777 WHERE event_id = ?"
        ).bind(eventId).run();
      } catch { updateBlocked = true; }
      try {
        await env.DB.prepare(
          "DELETE FROM prepurchase_payment_changes WHERE event_id = ?"
        ).bind(eventId).run();
      } catch { deleteBlocked = true; }
      const after = await env.DB.prepare(
        "SELECT amount_cents FROM prepurchase_payment_changes WHERE event_id = ?"
      ).bind(eventId).first();
      return Response.json({
        updateBlocked, deleteBlocked,
        rowUnchanged: Boolean(after && after.amount_cents === before.amount_cents)
      });
    }
    if (url.pathname === "/__test/changes" && request.method === "GET") {
      const rows = await env.DB.prepare("SELECT * FROM prepurchase_payment_changes ORDER BY event_id").all();
      return Response.json(rows.results);
    }

    // LOCAL-TEST-ONLY notification handoff probes. These are forbidden in the
    // deployed Worker; only this test entrypoint exposes them to Workerd.
    if (url.pathname === "/__test/notification/prepare" && request.method === "POST") {
      const { notificationKey, kind, noticeRef } = await request.json();
      if (!/^gwn1_[0-9a-f]{64}$/.test(notificationKey || "") ||
          !["purchase_confirmation", "refund_initiated"].includes(kind) ||
          (kind === "purchase_confirmation" && noticeRef !== "purchase") ||
          (kind === "refund_initiated" && !/^re_[a-zA-Z0-9]+$/.test(noticeRef || ""))) {
        return Response.json({ error: "Invalid local-only notification" }, { status: 400 });
      }
      const recipient = env.NOTIFICATION_TEST_RECIPIENT;
      const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(env.NOTIFICATION_RECIPIENT_HMAC_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const bytes = new Uint8Array(await crypto.subtle.sign(
        "HMAC", key, new TextEncoder().encode(recipient.trim().toLowerCase())
      ));
      const hmac = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
      const alias = kind === "purchase_confirmation"
        ? "groundwork-prepurchase-confirmation-review"
        : "groundwork-refund-initiated-review";
      const session = "cs_test_ABC123local";
      await env.DB.prepare(
        "INSERT INTO prepurchase_notification_outbox(notification_key,checkout_session_id,notice_type,notice_ref,recipient_hmac,template_alias) VALUES (?,?,?,?,?,?)"
      ).bind(notificationKey,session,kind,noticeRef,hmac,alias).run();
      await env.DB.prepare(
        "UPDATE prepurchase_notification_outbox SET state='review_verified',review_completed_at=datetime('now'),changed_at=datetime('now') WHERE notification_key=? AND state='review_pending'"
      ).bind(notificationKey).run();
      return Response.json({ state: "review_verified" });
    }
    if (url.pathname === "/__test/notification/dispatch" && request.method === "POST") {
      const { notificationKey } = await request.json();
      // Synthetic, local Workerd ONLY: retain a short, non-PII failure phase.
      // The production Worker does not import this entrypoint or expose this route.
      const outbox = isolatedD1NotificationStore(env.DB);
      const providerTransport = resendFounderTestTransport(env);
      let testPhase = "preflight";
      let testFailureClass = null;
      const store = {
        ...outbox,
        async claim(...args) {
          testPhase = "claim_attempt";
          return outbox.claim(...args);
        },
        async providerAccepted(...args) {
          testPhase = "provider_acceptance_record";
          try { return await outbox.providerAccepted(...args); }
          catch (err) {
            testFailureClass = "d1_record:" + String(err?.name || "Error");
            throw err;
          }
        },
      };
      const transport = {
        ...providerTransport,
        async send(...args) {
          testPhase = "provider_send_attempt";
          try {
            const receipt = await providerTransport.send(...args);
            testPhase = "provider_send_returned";
            return receipt;
          } catch (err) {
            testFailureClass = "provider_send:" + String(err?.name || "Error");
            throw err;
          }
        },
      };
      const result = await dispatchFounderTestNotification(env, notificationKey, {
        store, provider: stripeTestReadAdapter(env), transport,
        approval: {
          async isAuthorized() { return env.__TEST_OPERATOR_AUTHORIZED === "true"; },
          async deliveryCopy() { throw new Error("Not an authorized local notification"); },
        },
      });
      return Response.json({ ...result, __test_phase: testPhase,
        ...(testFailureClass ? { __test_failure_class: testFailureClass } : {}) });
    }
    if (url.pathname === "/__test/notification/outbox" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT notification_key,notice_type,notice_ref,state,attempt_token,provider_message_id FROM prepurchase_notification_outbox ORDER BY notice_type"
      ).all();
      const journal = await env.DB.prepare(
        "SELECT notification_key,old_state,new_state FROM prepurchase_notification_state_journal ORDER BY id"
      ).all();
      return Response.json({ rows: rows.results, journal: journal.results });
    }

    return paymentWorker.fetch(request,env,ctx);
  }
};

