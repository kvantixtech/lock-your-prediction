#!/usr/bin/env python3
"""Builds index.html (one self-contained file) from src/index.template.html, seal-core.js and
src/app.js. The inline scripts are pinned in the page's Content-Security-Policy by SHA-256,
which also blocks every network request. CI rebuilds and fails if index.html is out of date."""
import base64, hashlib, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(*p):
    with open(os.path.join(ROOT, *p), encoding="utf-8") as fh:
        return fh.read()


def build() -> str:
    core, app = read("seal-core.js"), read("src", "app.js")
    for name, code in (("seal-core.js", core), ("app.js", app)):
        if "</script" in code.lower():
            sys.exit(f"{name} must not contain </script")
    hashes = " ".join("'sha256-" + base64.b64encode(hashlib.sha256(c.encode()).digest()).decode() + "'" for c in (core, app))
    return (read("src", "index.template.html")
            .replace("{{SCRIPT_HASHES}}", hashes).replace("{{SEAL_CORE}}", core).replace("{{APP}}", app))


if __name__ == "__main__":
    html = build()
    out = os.path.join(ROOT, "index.html")
    if "--check" in sys.argv:
        same = os.path.exists(out) and read("index.html") == html
        print("index.html is up to date" if same else "index.html is out of date: run python3 tools/build_page.py")
        sys.exit(0 if same else 1)
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    print(f"wrote index.html ({len(html.encode())} bytes)")
