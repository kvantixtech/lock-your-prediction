#!/usr/bin/env python3
"""verify.py against test-vectors.json, a receipt round trip and the CLI. No network."""
import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import verify as v  # noqa: E402

fails = 0


def ok(cond, label):
    global fails
    print(("  OK   " if cond else "  FAIL ") + label)
    fails += 0 if cond else 1


vectors = json.load(open(os.path.join(ROOT, "test-vectors.json"), encoding="utf-8"))["vectors"]
print(f"1. {len(vectors)} test vectors")
for t in vectors:
    ok(v.normalise(t["input"]) == t["text"] and v.seal(t["key"], t["input"]) == t["seal"], t["name"])

print("2. receipt round trip")
t = vectors[8]
r = v.receipt(t["key"], t["input"], "2026-09-29T08:00:00Z", "2026-12-31")
key, body, s = v.parse_receipt(r)
ok(key == t["key"] and s == t["seal"] and v.seal(key, body) == t["seal"], "parse(receipt(x)) seals to the vector")
ok(v.parse_receipt(r.replace("\n", "\r\n"))[0] == t["key"], "receipt saved with CRLF still parses")
ok(v.seal(key, body + "\n\n") == t["seal"], "trailing blank lines after the text do not matter")
ok(v.seal(key, body.replace("30 mm", "31 mm")) != t["seal"], "one changed character breaks the seal")
ok(v.parse_receipt("key: " + "a" * 32 + "\nno separator") is None, "a receipt without the separator is rejected")

print("3. command line")
with tempfile.TemporaryDirectory() as d:
    rp = os.path.join(d, "r.txt")
    open(rp, "w", encoding="utf-8", newline="\n").write(r)
    run = lambda *a: subprocess.run([sys.executable, os.path.join(ROOT, "verify.py"), *a], capture_output=True, text=True)
    ok(run("check", rp, "--seal", t["seal"]).returncode == 0, "check: MATCH exits 0")
    ok(run("check", rp, "--seal", "0" * 64).returncode == 1, "check: NO MATCH exits 1")
    ok(run("check", rp, "--seal", "xyz").returncode == 2, "check: malformed seal exits 2")
    out = run("seal", "Rain in Hjørring on Saturday.", "--out", os.path.join(d, "new.txt"))
    ok(out.returncode == 0, "seal: writes a receipt")
    new = open(os.path.join(d, "new.txt"), encoding="utf-8").read()
    k2, b2, s2 = v.parse_receipt(new)
    ok(s2 in out.stdout and v.seal(k2, b2) == s2, "seal: receipt verifies against the printed seal")
    ok(run("hash", "--key", vectors[0]["key"], "--text", vectors[0]["input"]).stdout.strip() == vectors[0]["seal"], "hash: matches vector")

print("\nALL OK" if not fails else f"\n{fails} FAILED")
sys.exit(1 if fails else 0)
