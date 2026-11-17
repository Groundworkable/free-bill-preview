/**
 * DRAFT ONLY — authenticated Stripe TEST read adapter + restricted Resend adapter.
 *
 * No routes, schedules, deployment configuration, secrets, or automatic sending.
 * These are optional dependencies of notification_sender.sandbox.mjs, never
 * imported from worker.mjs or the deployed public site.
 *
 * A separately approved founder-only invocation, validated operator approval,
 * independent verified order and contact evidence, a published template and an
 * atomic D1 claim are required before the sender could call transport.send().
 *
 * Cloudflare Workerd supports redirect: "manual" (not "error"). Any 3xx
 * response is rejected via response.ok/jsonResponse; authentication headers are
 * never automatically forwarded to a redirect destination.
 * Network response bodies/PII/secrets are never logged.
 */

const sessionPattern = /^cs_test_[a-zA-Z0-9]+$/;
const refundPattern = /^re_[a-zA-Z0-9]+$/;
const keyPattern = /^gwn1_[a-f0-9]{64}$/;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const aliases = new Set([
  "groundwork-prepurchase-confirmation-review",
  "groundwork-prepurchase-delivery-update-review",
  "groundwork-refund-initiated-review",
]);
const FROM = "Groundwork by Able <billing@groundworkbyable.com>";

function validEmail(value) {
  if (typeof value !== "string" || value.length > 254) return null;
  const normalized = value.trim().toLowerCase();
  return emailPattern.test(normalized) ? normalized : null;
}

function readyStripe(env) {
  // Review may read Stripe TEST evidence independently of notification transport.
  return (env?.NOTIFICATION_SEND_MODE === "sandbox_founder_test" ||
    (env?.FOUNDER_NOTIFICATION_REVIEW_ENABLED === "true" &&
     env?.FOUNDER_NOTIFICATION_ADMIN_MODE === "sandbox_access_only")) &&
    env?.STRIPE_TEST_SECRET_KEY?.startsWith("sk_test_") &&
    env?.PAYMENTS_MODE === "sandbox" && env?.TERMS_APPROVED === "true";
}
function readyResend(env) {
  return env?.NOTIFICATION_SEND_MODE === "sandbox_founder_test" &&
    env?.NOTIFICATION_OPERATOR_RELEASE === "true" &&
    env?.NOTIFICATION_TEMPLATES_APPROVED === "true" &&
    env?.RESEND_API_KEY?.startsWith("re_") &&
    !!validEmail(env?.NOTIFICATION_TEST_RECIPIENT);
}

async function jsonResponse(response) {
  if (!response || !response.ok) throw new Error("Provider verification failed");
  // Limit JSON responses before parsing, to avoid very large unexpected bodies.
  const responseText = await response.text();
  if (responseText.length > 131072) throw new Error("Provider response too large");
  let payload;
  try { payload = JSON.parse(responseText); }
  catch { throw new Error("Invalid provider response"); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Unexpected provider object");
  }
  return payload;
}

/** Explicit Stripe test-only GETs; all identifiers are strict path segments. */
export function stripeTestReadAdapter(env, fetchFn = fetch) {
  if (typeof fetchFn !== "function") throw new Error("Trusted fetch required");
  async function get(kind, id) {
    if (!readyStripe(env)) throw new Error("Stripe sandbox read adapter disabled");
    if (kind === "checkout" && !sessionPattern.test(id || "")) throw new Error("Invalid checkout reference");
    if (kind === "lineItems" && !sessionPattern.test(id || "")) throw new Error("Invalid checkout reference");
    if (kind === "refund" && !refundPattern.test(id || "")) throw new Error("Invalid refund reference");
    const url = kind === "refund"
      ? "https://api.stripe.com/v1/refunds/" + encodeURIComponent(id)
      : "https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(id) +
        (kind === "lineItems" ? "/line_items?limit=2" : "");
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + env.STRIPE_TEST_SECRET_KEY,
        Accept: "application/json",
      },
      redirect: "manual",
    });
    const data = await jsonResponse(response);
    if (kind === "checkout" && (
      data.object !== "checkout.session" || data.id !== id || data.livemode !== false
    )) throw new Error("Unverified test Checkout");
    if (kind === "refund" && (
      data.object !== "refund" || data.id !== id || data.livemode !== false
    )) throw new Error("Unverified test refund");
    if (kind === "lineItems") {
      if (data.object !== "list" || data.has_more !== false ||
          !Array.isArray(data.data) || data.data.length !== 1) {
        throw new Error("Unverified test line items");
      }
      return data.data;
    }
    return data;
  }
  return {
    checkout(sessionId) { return get("checkout", sessionId); },
    lineItems(sessionId) { return get("lineItems", sessionId); },
    refund(refundId) { return get("refund", refundId); },
  };
}

/**
 * Resend adapter can operate only on the founder-approved test recipient and
 * three predefined aliases. API template.send is used (not raw HTML) with an
 * idempotency key. Every caller must separately prove contact ownership.
 */
export function resendFounderTestTransport(env, fetchFn = fetch) {
  if (typeof fetchFn !== "function") throw new Error("Trusted fetch required");
  const allowlisted = validEmail(env?.NOTIFICATION_TEST_RECIPIENT);
  async function templateIsPublished(alias) {
    if (!readyResend(env)) return false;
    if (!aliases.has(alias)) return false;
    const response = await fetchFn("https://api.resend.com/templates/" +
      encodeURIComponent(alias), {
      method: "GET",
      headers: { Authorization: "Bearer " + env.RESEND_API_KEY,
        "User-Agent": "Groundwork-Sandbox-Review/1.0",
        Accept: "application/json" },
      redirect: "manual",
    });
    if (!response.ok) return false;
    const data = await jsonResponse(response);
    // A template with pending unpublished edits must not silently send an
    // older public version after the founder approved the newer draft.
    return data.object === "template" && data.alias === alias &&
      data.status === "published" && data.has_unpublished_versions !== true;
  }
  async function send({ to, templateAlias, variables, idempotencyKey, from }) {
    if (!readyResend(env)) throw new Error("Resend founder test transport disabled");
    if (!allowlisted || validEmail(to) !== allowlisted) throw new Error("Destination not allowlisted");
    if (!aliases.has(templateAlias)) throw new Error("Unknown notification template");
    if (!keyPattern.test(idempotencyKey || "")) throw new Error("Invalid idempotency key");
    if (from !== FROM) throw new Error("Sender not allowed");
    if (!variables || typeof variables !== "object" || Array.isArray(variables) ||
        Object.keys(variables).length === 0 ||
        Object.entries(variables).some(([k,v]) =>
          !/^[A-Z_]+$/.test(k) || typeof v !== "string" || v.length > 2000)) {
      throw new Error("Invalid template variables");
    }
    // Fail closed if the candidate template is a draft or changed after review.
    if (await templateIsPublished(templateAlias) !== true) throw new Error("Template not published");
    const response = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "User-Agent": "Groundwork-Sandbox-Review/1.0",
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: [allowlisted],
        template: { id: templateAlias, variables },
      }),
      redirect: "manual",
    });
    const data = await jsonResponse(response);
    if (typeof data.id !== "string" ||
        !/^[a-f0-9-]{20,64}$/i.test(data.id)) throw new Error("Unverified provider receipt");
    return { id: data.id };
  }
  return { templateIsPublished, send };
}
