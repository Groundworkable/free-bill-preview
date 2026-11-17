/** Review only: assert Wrangler versions upload --dry-run produced a local bundle.
 * This test never uploads a version or contacts Cloudflare, Stripe, Resend or D1.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
const dir=new URL("./.founder-version-preservation-dry-run/",import.meta.url);
const entries=await readdir(dir,{withFileTypes:true});
const files=entries.filter(x=>x.isFile() && /\.m?js$/.test(x.name));
assert.equal(files.length,1,"Expected exactly one locally generated founder script");
const code=await readFile(new URL(files[0].name,dir),"utf8");
assert.ok(code.length>1000);
assert.ok(!/\bfrom\s+["']\.\//.test(code),"Unresolved source import");
assert.ok(!/["']\/__test\//.test(code),"Test-only route present");
assert.ok(!/["']\/webhooks\/stripe["']/.test(code),"Payment webhook route present");
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
assert.equal(typeof worker.fetch,"function");
const key="gwn1_"+"9".repeat(64);
const request=(p,method="GET")=>new Request("https://offline-founder.invalid"+p,{method});
const disabled={
 FOUNDER_ACCESS_AUD:"synthetic-local-audience-not-a-real-value",
 FOUNDER_ACCESS_EMAIL:"founder@example.invalid",
 FOUNDER_NOTIFICATION_ADMIN_MODE:"disabled",
 FOUNDER_NOTIFICATION_REVIEW_ENABLED:"false",
 FOUNDER_NOTIFICATION_DISPATCH_ENABLED:"false",
 NOTIFICATION_SEND_MODE:"disabled",
 NOTIFICATION_OPERATOR_RELEASE:"false",
 NOTIFICATION_TEMPLATES_APPROVED:"false",
 PAYMENTS_MODE:"disabled",
 TERMS_APPROVED:"false",
 TERMS_VERSION:"UNAPPROVED"
};
let calls=0;
globalThis.fetch=async()=>{calls++;throw Error("Unexpected network operation")};
for(const path of [
 "/founder/notifications/status?key="+key,
 "/founder/notifications/review",
 "/founder/notifications/dispatch"
]){
 const r=await worker.fetch(request(path,path.includes("status")?"GET":"POST"),disabled,{});
 assert.equal(r.status,503,"Disabled operation must respond 503: "+path);
 assert.equal((await r.json()).status,"service_disabled");
}
assert.equal(calls,0,"No provider/network calls are allowed");
console.log("PASS: local-only strict version-upload bundle has no test/webhook routes and cannot operate with disabled flags");
