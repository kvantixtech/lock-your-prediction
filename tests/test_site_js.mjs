// Runs the exact file served on kvantix.tech (site/kvx-seal.js) in a minimal fake DOM and
// verifies every test vector through its own "Check it" handler. Node 18+, no dependencies.
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import vm from "node:vm";

const core = createRequire(import.meta.url)("../seal-core.js");
const { vectors } = JSON.parse(readFileSync(new URL("../test-vectors.json", import.meta.url), "utf8"));
const src = readFileSync(new URL("../site/kvx-seal.js", import.meta.url), "utf8");

const els = {};
const el = (id) => (els[id] ||= { id, value: "", textContent: "", hidden: true, disabled: false, className: "",
  dataset: {}, handlers: {}, files: null,
  addEventListener(t, f) { this.handlers[t] = f; }, appendChild(c) { this.textContent += c.textContent; },
  scrollIntoView() {}, focus() {} });
const document = {
  readyState: "complete", getElementById: el,
  createElement: () => ({ textContent: "" }), createTextNode: (t) => ({ textContent: t }),
  addEventListener() {}, body: { appendChild() {}, removeChild() {} },
};
el("kvx-seal"); // the root must exist
const ctx = { document, crypto: webcrypto, TextEncoder, setTimeout, navigator: {}, URL, Blob, console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);

let fails = 0;
for (const t of vectors) {
  el("kvx-seal-receipt").value = core.receipt({ seal: t.seal, key: t.key, text: t.input, at: "x", reveal: "" });
  el("kvx-verify-seal").value = t.seal;
  el("kvx-verify-out").textContent = "";
  el("kvx-verify-form").handlers.submit({ preventDefault() {} });
  for (let i = 0; i < 50 && !el("kvx-verify-out").textContent; i++) await new Promise((r) => setTimeout(r, 5));
  const good = el("kvx-verify-out").textContent.startsWith("MATCH");
  console.log((good ? "  OK   " : "  FAIL ") + t.name);
  if (!good) fails++;
}
// and a wrong seal must be rejected
el("kvx-verify-seal").value = "0".repeat(64); el("kvx-verify-out").textContent = "";
el("kvx-verify-form").handlers.submit({ preventDefault() {} });
for (let i = 0; i < 50 && !el("kvx-verify-out").textContent; i++) await new Promise((r) => setTimeout(r, 5));
const rejected = el("kvx-verify-out").textContent.startsWith("NO MATCH");
console.log((rejected ? "  OK   " : "  FAIL ") + "wrong seal is rejected");
if (!rejected) fails++;
console.log(fails ? `\n${fails} FAILED` : "\nALL OK (site/kvx-seal.js agrees with the spec)");
process.exitCode = fails ? 1 : 0;
