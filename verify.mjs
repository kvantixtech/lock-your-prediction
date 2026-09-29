#!/usr/bin/env node
// Kvantix seal v1: seal a prediction or verify a receipt. Node 18+, no dependencies.
//
//   node verify.mjs check receipt.txt --seal <published seal>
//   node verify.mjs seal "Bitcoin closes 2026 above $100,000 on Gemini."   [--reveal YYYY-MM-DD]
//   node verify.mjs hash --key <32 hex> --text "..."
//
// Written separately from verify.py and the browser tool on purpose: independent
// implementations that agree on test-vectors.json. Specification: SPEC.md.
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export const PREFIX = "kvantix-seal-v1\n";
export const SEP = "--- prediction (everything below this line, exactly) ---";
const PAGE = "https://kvantix.tech/playground/lock-your-prediction/";

export function normalise(text) {
  return String(text).replace(/\r\n?/g, "\n").normalize("NFC").trim(); // trim = SPEC §2 set
}

export function seal(key, text) {
  if (!/^[0-9a-f]{32}$/.test(key)) throw new Error("key must be 32 lowercase hex characters");
  return createHash("sha256").update(PREFIX + key + "\n" + normalise(text), "utf8").digest("hex");
}

export function parseReceipt(raw) {
  raw = String(raw).replace(/\r\n?/g, "\n");
  const i = raw.indexOf(SEP);
  if (i < 0) return null;
  const head = raw.slice(0, i);
  const body = raw.slice(i + SEP.length).replace(/^\n/, "");
  const km = head.match(/^key:\s*([0-9a-f]{32})\s*$/im);
  if (!km) return null;
  const sm = head.match(/^seal:\s*([0-9a-f]{64})\s*$/im);
  return { key: km[1].toLowerCase(), body, seal: sm ? sm[1].toLowerCase() : "" };
}

function arg(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === "check") {
    const file = rest.find((x, i) => !x.startsWith("--") && rest[i - 1] !== "--seal");
    const r = parseReceipt(readFileSync(file, "utf8"));
    if (!r) { console.log("NOT A RECEIPT: the key line or the '--- prediction' line is missing."); return 2; }
    const want = (arg(rest, "--seal") || "").trim().toLowerCase();
    if (want && !/^[0-9a-f]{64}$/.test(want)) { console.log("The published seal must be 64 characters, 0-9 and a-f."); return 2; }
    const got = seal(r.key, r.body), against = want || r.seal;
    if (!want) console.log("note: no --seal given, so this only compares with the seal written in the receipt. Compare with the seal that was published.");
    if (got === against) {
      console.log(`MATCH  ${got}`);
      console.log("This exact text was sealed. When it was sealed is proven by where the seal was published.");
      return 0;
    }
    console.log(`NO MATCH  text + key give ${got}`);
    console.log(`          expected         ${against || "(none)"}`);
    return 1;
  }
  if (cmd === "seal") {
    const text = normalise(rest.find((x, i) => !x.startsWith("--") && !["--reveal", "--out"].includes(rest[i - 1])) ?? readFileSync(0, "utf8"));
    if (!text) { console.error("Write a prediction first."); return 2; }
    const key = randomBytes(16).toString("hex"), s = seal(key, text), reveal = arg(rest, "--reveal") || "";
    const at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    const out = arg(rest, "--out") || `kvantix-seal-${s.slice(0, 12)}.txt`;
    writeFileSync(out, "KVANTIX SEAL v1\n" + `seal: ${s}\n` + `key: ${key}\n` +
      `sealed (your device clock, not a proof): ${at}\n` + (reveal ? `planned reveal: ${reveal}\n` : "") +
      `verify: ${PAGE}\n${SEP}\n${text}\n`);
    console.log(`seal: ${s}`);
    console.log(`receipt: ${out}  (keep it private until you reveal; publish only the seal)`);
    return 0;
  }
  if (cmd === "hash") {
    console.log(seal(String(arg(rest, "--key") || "").toLowerCase(), arg(rest, "--text") ?? ""));
    return 0;
  }
  console.log("usage: node verify.mjs check <receipt> --seal <hex> | seal <text> [--reveal date] [--out file] | hash --key <hex> --text <text>");
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("verify.mjs")) {
  process.exitCode = main(process.argv.slice(2));
}
