/**
 * Offline deterministic artifact gate.
 * The archived review bundle must be exactly the code that Wrangler's
 * future version-upload command would compile, not merely a similar module.
 * No Cloudflare authentication, version upload, deploy, network or provider use.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

async function singleBundle(dirName) {
  const base = new URL("./" + dirName + "/", import.meta.url);
  const entries = (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.m?js$/.test(entry.name));
  assert.equal(entries.length, 1, `Expected exactly one JS file in ${dirName}`);
  return await readFile(new URL(entries[0].name, base));
}

const deployBuild = await singleBundle(".founder-runtime-build");
const versionBuild = await singleBundle(".founder-version-preservation-dry-run");

assert.ok(versionBuild.length > 1000, "Empty version-upload bundle");
assert.deepEqual(
  versionBuild, deployBuild,
  "Version-upload compilation differs from the tested deploy dry-run bundle; stop packaging and investigate"
);
const sha = createHash("sha256").update(versionBuild).digest("hex");
console.log("PASS: deploy dry-run and version-upload dry-run produced identical founder bundle bytes");
console.log("REVIEW ONLY SHA256:", sha);
