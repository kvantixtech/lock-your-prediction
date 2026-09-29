#!/usr/bin/env python3
"""Regenerates test-vectors.json from verify.py. CI checks that verify.mjs, the browser
core and plain `printf | sha256sum` reproduce every vector independently."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from verify import normalise, seal  # noqa: E402

K1 = "0123456789abcdef0123456789abcdef"
K2 = "9f2c4e71a0b35d68c1e7f40a2b96d3c5"
CASES = [
    ("docs example", K1, "Bitcoin closes 2026 above $100,000 on Gemini."),
    ("plain ascii", K2, "Denmark beats Norway 2-1 on 12 October."),
    ("windows line breaks become LF", K2, "Line one\r\nLine two\r\n"),
    ("old mac CR becomes LF", K2, "Line one\rLine two"),
    ("surrounding spaces, tabs and newlines trimmed", K2, " \t\n  Rain in Hjørring on Saturday. \n\n"),
    ("inner spacing and blank lines kept", K2, "a  b\n\n\nc"),
    ("NFD input is normalised to NFC", K2, "Café au lait"),
    ("NFC input unchanged", K2, "Café au lait"),
    ("danish letters", K2, "Hjørring får 30 mm regn på lørdag. Æbler, øl og ål."),
    ("emoji and CJK", K2, "🚀 BTC > 100k · 天气预报"),
    ("BOM and no-break space are trimmed (ECMAScript trim)", K2, "﻿ prediction　"),
    ("U+0085 and U+001F are NOT trimmed (unlike Python str.strip)", K2, "\u0085prediction\u001f"),
    ("single character", K2, "x"),
]


def main():
    out = []
    for name, key, raw in CASES:
        text = normalise(raw)
        out.append({"name": name, "key": key, "input": raw, "text": text, "seal": seal(key, raw)})
    assert normalise("Café au lait") == "Café au lait"
    assert seal(K2, CASES[6][2]) == seal(K2, CASES[7][2]), "NFD and NFC must seal the same"
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "test-vectors.json")
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump({"spec": "kvantix-seal-v1", "vectors": out}, fh, ensure_ascii=True, indent=2)
        fh.write("\n")
    print(f"{len(out)} vectors -> {path}")


if __name__ == "__main__":
    main()
