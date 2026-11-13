/**
 * Test-only entrypoint for the local Workerd/D1 harness.
 * NOT included in the sandbox Worker deployment template.
 */
import paymentWorker from "./worker.mjs";
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/__test/seed" && request.method === "POST") {
      await env.DB.exec(env.__TEST_SCHEMA);
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
    return paymentWorker.fetch(request,env,ctx);
  }
};
