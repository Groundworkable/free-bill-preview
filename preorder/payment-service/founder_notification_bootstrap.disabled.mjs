/**
 * GROUNDWORK FOUNDER NOTIFICATIONS — DISABLED BOOTSTRAP.
 * This is the ONLY source authorized for initial creation of the separate
 * groundwork-founder-notifications-isolated Worker.
 *
 * It has no payment, database, Access identity, notification, email, test,
 * review, approval or dispatch functionality. It must stay inert even if a
 * default workers.dev URL is temporarily reachable before Access is applied.
 *
 * DO NOT paste founder_notification_worker.draft.mjs yet.
 * DO NOT paste this code into groundwork-payment-sandbox-isolated.
 */
export default {
  async fetch() {
    return new Response("Founder service disabled", {
      status: 503,
      headers: {
        "Cache-Control": "no-store, private",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  },
};
