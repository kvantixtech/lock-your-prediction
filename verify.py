#!/usr/bin/env python3
"""Kvantix seal v1: seal a prediction or verify a receipt. Standard library only, Python 3.9+.

  python3 verify.py check receipt.txt --seal <published seal>
  python3 verify.py seal "Bitcoin closes 2026 above $100,000 on Gemini."   (or text on stdin)
  python3 verify.py hash --key <32 hex> --text "..."

Specification: SPEC.md. Nothing is sent anywhere.
"""
import argparse
import hashlib
import re
import secrets
import sys
import unicodedata
from datetime import datetime, timezone

PREFIX = "kvantix-seal-v1\n"
SEP = "--- prediction (everything below this line, exactly) ---"
PAGE = "https://kvantix.tech/playground/lock-your-prediction/"

# Exactly ECMAScript's String.prototype.trim set (SPEC §2). Not Python's str.isspace().
TRIM = frozenset(
    "\u0009\u000a\u000b\u000c\u000d   "
    "           "
    "    　﻿"
)
KEY_RE = re.compile(r"^key:\s*([0-9a-f]{32})\s*$", re.I | re.M)
SEAL_RE = re.compile(r"^seal:\s*([0-9a-f]{64})\s*$", re.I | re.M)
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def normalise(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = unicodedata.normalize("NFC", text)
    i, j = 0, len(text)
    while i < j and text[i] in TRIM:
        i += 1
    while j > i and text[j - 1] in TRIM:
        j -= 1
    return text[i:j]


def seal(key: str, text: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{32}", key):
        raise ValueError("key must be 32 lowercase hex characters")
    return hashlib.sha256((PREFIX + key + "\n" + normalise(text)).encode("utf-8")).hexdigest()


def parse_receipt(raw: str):
    """Returns (key, body, seal_in_receipt) or None. SPEC §3."""
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")
    i = raw.find(SEP)
    if i < 0:
        return None
    head, body = raw[:i], raw[i + len(SEP):]
    if body.startswith("\n"):
        body = body[1:]
    km = KEY_RE.search(head)
    if not km:
        return None
    sm = SEAL_RE.search(head)
    return km.group(1).lower(), body, (sm.group(1).lower() if sm else "")


def receipt(key: str, text: str, at: str, reveal: str = "") -> str:
    text = normalise(text)
    return ("KVANTIX SEAL v1\n"
            f"seal: {seal(key, text)}\n"
            f"key: {key}\n"
            f"sealed (your device clock, not a proof): {at}\n"
            + (f"planned reveal: {reveal}\n" if reveal else "")
            + f"verify: {PAGE}\n{SEP}\n{text}\n")


def cmd_check(a) -> int:
    with open(a.receipt, encoding="utf-8-sig" if a.bom else "utf-8") as fh:
        parsed = parse_receipt(fh.read())
    if not parsed:
        print("NOT A RECEIPT: the key line or the '--- prediction' line is missing.")
        return 2
    key, body, in_receipt = parsed
    want = (a.seal or "").strip().lower()
    if want and not HEX64.match(want):
        print("The published seal must be 64 characters, 0-9 and a-f.")
        return 2
    got = seal(key, body)
    against = want or in_receipt
    if not want:
        print("note: no --seal given, so this only compares with the seal written in the receipt."
              " Compare with the seal that was published.")
    if got == against:
        print(f"MATCH  {got}")
        print("This exact text was sealed. When it was sealed is proven by where the seal was published.")
        return 0
    print(f"NO MATCH  text + key give {got}")
    print(f"          expected         {against or '(none)'}")
    return 1


def cmd_seal(a) -> int:
    text = a.text if a.text is not None else sys.stdin.read()
    text = normalise(text)
    if not text:
        print("Write a prediction first.", file=sys.stderr)
        return 2
    key = secrets.token_hex(16)
    at = datetime.now(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    r = receipt(key, text, at, a.reveal or "")
    s = seal(key, text)
    out = a.out or f"kvantix-seal-{s[:12]}.txt"
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(r)
    print(f"seal: {s}")
    print(f"receipt: {out}  (keep it private until you reveal; publish only the seal)")
    return 0


def cmd_hash(a) -> int:
    print(seal(a.key.lower(), a.text))
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Kvantix seal v1 (SPEC.md)")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("check", help="verify a receipt against the published seal")
    s.add_argument("receipt")
    s.add_argument("--seal", help="the seal that was published (64 hex)")
    s.add_argument("--bom", action="store_true", help="the file starts with a UTF-8 BOM")
    s = sub.add_parser("seal", help="seal a prediction and write a receipt")
    s.add_argument("text", nargs="?", help="the prediction (default: read stdin)")
    s.add_argument("--reveal", help="planned reveal date, YYYY-MM-DD (not part of the seal)")
    s.add_argument("--out", help="receipt file name")
    s = sub.add_parser("hash", help="low level: seal of a key and a text")
    s.add_argument("--key", required=True)
    s.add_argument("--text", required=True)
    a = p.parse_args(argv)
    return {"check": cmd_check, "seal": cmd_seal, "hash": cmd_hash}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
