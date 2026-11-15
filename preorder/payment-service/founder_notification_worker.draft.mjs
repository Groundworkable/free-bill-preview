/**
 * DRAFT ONLY — founder-only isolated notification runtime, NOT DEPLOYED.
 *
 * Deploy only as a separately approved, Access-protected isolated Worker.
 * NOT an entrypoint for the current payment Worker or the public website.
 * Does not prepare, create, or approve notices. The review_verified ledger
 * transition must be separately performed and independently substantiated.
 * Never import worker.local.entry.mjs or expose /__test/*.
 *
 * Cloudflare Access authenticates direct Worker requests via ctx.access.
 * Do not treat email or Cf-Access-* request headers as proof of identity.
 * See https://developers.cloudflare.com/workers/configuration/cloudflare-access/
 */
import { dispatchFounderTestNotification, isolatedD1NotificationStore } from "./notification_sender.sandbox.mjs";
import { stripeTestReadAdapter, resendFounderTestTransport } from "./notification_provider_adapters.sandbox.mjs";
import { independentlyReviewFounderNotice, isolatedD1ReviewStore } from "./notification_reviewer.draft.mjs";

const notificationKeyPattern = /^gwn1_[a-f0-9]{64}$/;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CONFIRM = "SEND_FOUNDER_TEST_NOTICE";
const REVIEW_CONFIRM = "REVIEW_FOUNDER_TEST_NOTICE";
const NO_STORE = Object.freeze({
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'",
});

function reply(message, status) {
  return new Response(JSON.stringify({ status: message }), {
    status, headers: { ...NO_STORE, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizedEmail(value) {
  if (typeof value !== "string" || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  return emailPattern.test(email) ? email : null;
}
function adminConfigured(env) {
  return env?.FOUNDER_NOTIFICATION_ADMIN_MODE === "sandbox_access_only" &&
    typeof env?.FOUNDER_ACCESS_AUD === "string" &&
    env.FOUNDER_ACCESS_AUD.length >= 16 &&
    !!normalizedEmail(env?.FOUNDER_ACCESS_EMAIL) &&
    !!env?.DB;
}
function dispatchConfigured(env) {
  return adminConfigured(env) &&
    env.FOUNDER_NOTIFICATION_DISPATCH_ENABLED === "true" &&
    env.NOTIFICATION_SEND_MODE === "sandbox_founder_test" &&
    env.NOTIFICATION_OPERATOR_RELEASE === "true" &&
    env.NOTIFICATION_TEMPLATES_APPROVED === "true" &&
    env.PAYMENTS_MODE === "sandbox" &&
    env.TERMS_APPROVED === "true" &&
    /^prepurchase-v\d{4}-\d{2}-\d{2}$/.test(env.TERMS_VERSION || "");
}
async function authenticate(env, ctx) {
  // ctx.access is supplied only for an Access-authenticated direct invocation.
  // Subrequests and spoofed headers do not create this trusted runtime object.
  if (!ctx?.access || ctx.access.aud !== env.FOUNDER_ACCESS_AUD ||
      typeof ctx.access.getIdentity !== "function") return false;
  try {
    const identity = await ctx.access.getIdentity();
    return normalizedEmail(identity?.email) === normalizedEmail(env.FOUNDER_ACCESS_EMAIL);
  } catch {
    return false;
  }
}
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true; // non-browser operator clients send no Origin
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}
async function readOperatorRequest(request,expectedConfirm,expectedAction) {
  const type = request.headers.get("Content-Type") || "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type)) return null;
  if (request.headers.get("X-Groundwork-Operator-Action") !== expectedAction) return null;
  if (Number(request.headers.get("Content-Length") || 0) > 512) return null;
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 512) return null;
  let parsed;
  try { parsed = JSON.parse(body); } catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      Object.keys(parsed).sort().join(",") !== "confirm,notificationKey") return null;
  if (parsed.confirm !== expectedConfirm ||
      !notificationKeyPattern.test(parsed.notificationKey || "")) return null;
  return parsed.notificationKey;
}

/**
 * Dependency injection exists ONLY for offline tests. The exported default
 * Worker always uses the trusted D1, Stripe read and Resend adapters above.
 */
export function createFounderNotificationWorker({
  sender = dispatchFounderTestNotification,
  createStore = isolatedD1NotificationStore,
  createStripe = stripeTestReadAdapter,
  createResend = resendFounderTestTransport,
  reviewer = independentlyReviewFounderNotice,
  createReviewStore = isolatedD1ReviewStore,
} = {}) {
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const statusRoute = url.pathname === "/founder/notifications/status";
      const dispatchRoute = url.pathname === "/founder/notifications/dispatch";
      const reviewRoute = url.pathname === "/founder/notifications/review";
      if (!statusRoute && !dispatchRoute && !reviewRoute) return reply("not_found",404);
      if (statusRoute && request.method !== "GET" ||
          (dispatchRoute || reviewRoute) && request.method !== "POST") return reply("method_not_allowed",405);
      if (!adminConfigured(env)) return reply("service_disabled",503);
      if (!await authenticate(env, ctx)) return reply("access_denied",403);
      if (!sameOrigin(request)) return reply("origin_denied",403);
      if (request.headers.has("Cookie") && request.method === "POST" &&
          !request.headers.has("X-Groundwork-Operator-Action")) {
        return reply("operator_action_required",403);
      }

      if (statusRoute) {
        if (url.searchParams.size !== 1 || !url.searchParams.has("key") ||
            !notificationKeyPattern.test(url.searchParams.get("key") || "")) {
          return reply("invalid_reference",400);
        }
        try {
          const row = await createStore(env.DB).get(url.searchParams.get("key"));
          if (!row) return reply("not_found",404);
          return new Response(JSON.stringify({
            status: "found",
            noticeType: row.notice_type,
            state: row.state,
            reviewed: typeof row.review_completed_at === "string" &&
              row.review_completed_at.length > 0,
          }), { status:200, headers:{ ...NO_STORE, "Content-Type":"application/json; charset=utf-8" } });
        } catch { return reply("storage_unavailable",503); }
      }

      if (reviewRoute) {
        if (env.FOUNDER_NOTIFICATION_REVIEW_ENABLED !== "true") return reply("review_disabled",503);
        let key;
        try { key = await readOperatorRequest(request,REVIEW_CONFIRM,"founder-review"); }
        catch { return reply("invalid_request",400); }
        if (!key) return reply("invalid_request",400);
        try {
          // Acquire identity directly from trusted Access again; never from a header.
          const verifiedIdentity = await ctx.access.getIdentity();
          const result = await reviewer(env,key,verifiedIdentity.email,{
            store:createReviewStore(env.DB),provider:createStripe(env),
          });
          return reply(result.status,result.status === "review_verified" ? 200 :
            result.status==="review_disabled" ? 503 : 409);
        } catch { return reply("review_unavailable",503); }
      }

      // Sending requires a separate explicit enablement, beyond Access login.
      if (!dispatchConfigured(env)) return reply("dispatch_disabled",503);
      let key;
      try { key = await readOperatorRequest(request,CONFIRM,"founder-dispatch"); }
      catch { return reply("invalid_request",400); }
      if (!key) return reply("invalid_request",400);

      try {
        const store = createStore(env.DB);
        const row = await store.get(key);
        // Manual review is a distinct, auditable prior step; this endpoint
        // cannot create a notice, approve a case or override its state.
        if (!row || row.notification_key !== key ||
            row.state !== "review_verified" ||
            typeof row.review_completed_at !== "string" ||
            !row.review_completed_at) return reply("review_not_verified",409);
        // No signed delivery-copy approval adapter exists yet; fail closed.
        if (row.notice_type === "delivery_update") return reply("delivery_review_not_configured",409);

        const approval = {
          async isAuthorized(askedKey, checkedRow) {
            return askedKey === key && checkedRow.notification_key === key &&
              checkedRow.state === "review_verified" &&
              checkedRow.review_completed_at === row.review_completed_at &&
              dispatchConfigured(env);
          },
          async deliveryCopy() { throw new Error("Delivery copy requires separate review"); },
        };
        const result = await sender(env, key, {
          store,
          provider: createStripe(env),
          transport: createResend(env),
          approval,
        });
        // A claimed send is never retried automatically, including on 5xx.
        return reply(result.status, result.status === "provider_accepted_await_delivery_evidence"
          ? 200 : result.status === "disabled" ? 503 : 409);
      } catch {
        // Do not disclose identity, provider errors, request bodies or secrets.
        return reply("manual_reconciliation_required",503);
      }
    },
  };
}

export default createFounderNotificationWorker();
