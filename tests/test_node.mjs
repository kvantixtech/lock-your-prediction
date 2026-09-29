// verify.mjs and seal-core.js (the browser core) against test-vectors.json. Node 18+, no network.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as cli from "../verify.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = createRequire(import.meta.url)("../seal-core.js");
const { vectors } = JSON.parse(readFileSync(join(ROOT, "test-vectors.json"), "utf8"));
let fails = 0;
const ok = (c, label) => { console.log((c ? "  OK   " : "  FAIL ") + label); if (!c) fails++; };

console.log(`1. verify.mjs: ${vectors.length} vectors`);
for (const t of vectors) ok(cli.normalise(t.input) === t.text && cli.seal(t.key, t.input) === t.seal, t.name);

console.log(`2. seal-core.js (browser code, Web Crypto): ${vectors.length} vectors`);
for (const t of vectors) ok(core.normalise(t.input) === t.text && (await core.seal(t.key, t.input)) === t.seal, t.name);

console.log("3. browser receipt verified by the Node CLI");
const t = vectors[8];
const r = core.receipt({ seal: t.seal, key: t.key, text: t.input, at: "2026-09-29T08:00:00Z", reveal: "" });
const p = cli.parseReceipt(r);
ok(p && cli.seal(p.key, p.body) === t.seal, "receipt from seal-core parses and seals in verify.mjs");
const d = mkdtempSync(join(tmpdir(), "kvxseal-"));
writeFileSync(join(d, "r.txt"), r);
const run = (...a) => { try { execFileSync(process.execPath, [join(ROOT, "verify.mjs"), ...a], { stdio: "pipe" }); return 0; } catch (e) { return e.status; } };
ok(run("check", join(d, "r.txt"), "--seal", t.seal) === 0, "CLI check: MATCH exits 0");
ok(run("check", join(d, "r.txt"), "--seal", "0".repeat(64)) === 1, "CLI check: NO MATCH exits 1");
const k = core.newKey();
ok(/^[0-9a-f]{32}$/.test(k) && k !== core.newKey(), "newKey: 32 hex, random");

console.log(fails ? `\n${fails} FAILED` : "\nALL OK");
process.exitCode = fails ? 1 : 0;
