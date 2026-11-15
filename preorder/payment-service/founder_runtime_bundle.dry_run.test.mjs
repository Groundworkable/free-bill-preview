/**
 * Verifies the ACTUAL Cloudflare Wrangler --dry-run bundle, not only source.
 * Local-only; NEVER invokes Cloudflare, Resend, Stripe, or remote D1.
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const outDir = new URL("./.founder-runtime-build/", import.meta.url);
const entries = await readdir(outDir, { withFileTypes: true });
const modules = entries.filter((e) => e.isFile() && /\.m?js$/.test(e.name));
assert.equal(modules.length, 1, "Expected exactly one bundled Cloudflare JS entrypoint");

const bundled = await readFile(new URL(modules[0].name, outDir), "utf8");
assert.ok(bundled.length > 1000, "Missing or empty runtime bundle");
assert.ok(!/\bfrom\s+["']\.\//.test(bundled), "Found unresolved relative ES module import");
assert.ok(!/\bfrom\s+["']node:/.test(bundled), "Node-only import in Worker bundle");
assert.ok(!/["']\/__test\//.test(bundled), "Forbidden test-only route in bundle");
assert.ok(!/Cf-Access-Authenticated-User-Email["']\s*\)/.test(bundled), "Untrusted identity header used");
assert.ok(!/["']\/webhooks\/stripe["']/.test(bundled), "Payment webhook route included in founder bundle");

const { default: worker } = await import(
  "data:text/javascript;base64," + Buffer.from(bundled).toString("base64")
);
assert.equal(typeof worker?.fetch, "function", "Missing Worker fetch export");

const fakeAud = "local-only-fake-access-audience";
const disabled = Object.freeze({
  FOUNDER_ACCESS_AUD: fakeAud,
  FOUNDER_ACCESS_EMAIL: "founder@example.invalid",
  FOUNDER_NOTIFICATION_ADMIN_MODE: "disabled",
  FOUNDER_NOTIFICATION_REVIEW_ENABLED: "false",
  FOUNDER_NOTIFICATION_DISPATCH_ENABLED: "false",
  NOTIFICATION_SEND_MODE: "disabled",
  NOTIFICATION_OPERATOR_RELEASE: "false",
  NOTIFICATION_TEMPLATES_APPROVED: "false",
  PAYMENTS_MODE: "disabled",
  TERMS_APPROVED: "false",
  TERMS_VERSION: "UNAPPROVED",
});
const key = "gwn1_" + "9".repeat(64);
const trustedCtx = {
  access: { aud: fakeAud, async getIdentity() { return { email: "founder@example.invalid" }; } },
};
let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw Error("Network forbidden during offline bundle test"); };
const request = (path, init) => new Request("https://offline-founder-worker.invalid" + path, init);
async function get(path, env = disabled, ctx = trustedCtx) {
  return worker.fetch(request(path), env, ctx);
}
const post = (path, env = disabled, ctx = trustedCtx, headers = {}) => worker.fetch(
  request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Groundwork-Operator-Action": path.endsWith("/review") ? "founder-review" : "founder-dispatch",
      ...headers,
    },
    body: JSON.stringify({ notificationKey: key, confirm:
      path.endsWith("/review") ? "REVIEW_FOUNDER_TEST_NOTICE" : "SEND_FOUNDER_TEST_NOTICE" }),
  }), env, ctx
);

for (const [label, response] of [
  ["status", await get("/founder/notifications/status?key=" + key)],
  ["review", await post("/founder/notifications/review")],
  ["dispatch", await post("/founder/notifications/dispatch")],
]) {
  assert.equal(response.status, 503, label + " must fail closed while administratively disabled");
  assert.equal((await response.json()).status, "service_disabled");
  assert.equal(response.headers.get("Cache-Control"), "no-store, private");
}

for (const path of ["/", "/__test/notification/dispatch", "/webhooks/stripe"]) {
  assert.equal((await get(path)).status, 404, "No forbidden route: " + path);
}

// The future admin gate cannot be opened solely through request headers,
// and review/dispatch remain independently disabled after valid local auth.
const adminOnly = { ...disabled, FOUNDER_NOTIFICATION_ADMIN_MODE: "sandbox_access_only", DB: {} };
assert.equal((await get("/founder/notifications/status?key=" + key, adminOnly, {})).status, 403);
assert.equal((await get("/founder/notifications/status?key=" + key, adminOnly, {
  access: { aud: fakeAud, async getIdentity() { return { email: "other@example.invalid" }; } },
})).status, 403);
assert.equal((await get("/founder/notifications/status?key=" + key, adminOnly, {
  access: { aud: "wrong-audience", async getIdentity() { return { email: "founder@example.invalid" }; } },
})).status, 403);
assert.equal((await post("/founder/notifications/dispatch", adminOnly, trustedCtx)).status, 503);
assert.equal((await post("/founder/notifications/review", adminOnly, trustedCtx)).status, 503);
assert.equal(networkCalls, 0, "Bundle must never call Stripe/Resend while disabled");
console.log("PASS: Wrangler dry-run bundle loads; Access checks and all admin/review/send gates fail closed");
