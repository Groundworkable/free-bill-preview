/**
 * Test-only entrypoint for the local Workerd/D1 harness.
 * NOT included in the sandbox Worker deployment template.
 */
import paymentWorker from "./worker.mjs";
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
    if (url.pathname === "/__test/changes" && request.method === "GET") {
      const rows = await env.DB.prepare("SELECT * FROM prepurchase_payment_changes ORDER BY event_id").all();
      return Response.json(rows.results);
    }
    return paymentWorker.fetch(request,env,ctx);
  }
};

