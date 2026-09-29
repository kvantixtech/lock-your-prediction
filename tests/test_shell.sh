#!/usr/bin/env bash
# Plain printf | sha256sum against every vector: no Kvantix code involved.
# Vector texts are read as base64 so line breaks survive the shell.
set -euo pipefail
cd "$(dirname "$0")/.."
fails=0; n=0
while IFS=$'\t' read -r key b64 want name; do
  n=$((n+1))
  TEXT=$(printf '%s' "$b64" | base64 -d)
  got=$(printf 'kvantix-seal-v1\n%s\n%s' "$key" "$TEXT" | sha256sum | cut -d' ' -f1)
  if [ "$got" = "$want" ]; then echo "  OK   $name"; else echo "  FAIL $name"; fails=$((fails+1)); fi
done < <(python3 -c '
import json, base64
for t in json.load(open("test-vectors.json", encoding="utf-8"))["vectors"]:
    print(t["key"], base64.b64encode(t["text"].encode()).decode(), t["seal"], t["name"], sep="\t")')
[ "$fails" -eq 0 ] && echo "ALL OK ($n vectors)" || { echo "$fails FAILED"; exit 1; }
