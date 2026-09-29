# Kvantix seal v1: specification

Status: stable. Any change gets a new prefix (`kvantix-seal-v2`), so v1 seals stay verifiable forever.

## 1. The seal

```
seal = lowercase_hex( SHA-256( UTF-8( "kvantix-seal-v1" LF key LF text ) ) )
```

- `LF` is U+000A. No trailing line break after `text`.
- `key` is exactly 32 lowercase hexadecimal characters (128 bits). It is generated from a cryptographically secure random source (`crypto.getRandomValues`, `secrets.token_hex(16)`). The key stops anyone from checking guesses against a published seal: without it, a short prediction like "Denmark wins" could be found by trying likely texts.
- `text` is the prediction after normalisation (§2). It is 1 to 2,000 characters long after normalisation. The limit applies to the web tool only and is not part of the hash.

## 2. Normalisation of the text

Applied in this order, identically when sealing and when verifying:

1. **Line breaks.** Every CR LF pair, and every lone CR, becomes LF.
2. **Unicode NFC.** The text is normalised to Normalization Form C. For example, `e` + U+0301 COMBINING ACUTE becomes `é` U+00E9. Two texts that look the same get the same seal.
3. **Trim.** Leading and trailing characters are removed if they belong to exactly this set, which is ECMAScript's `String.prototype.trim`:
   - U+0009, U+000A, U+000B, U+000C, U+000D, U+0020, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF.

   Characters that some languages treat as whitespace but ECMAScript does not, such as U+001C–U+001F and U+0085, are **not** removed. Python's `str.strip()` is therefore not a correct implementation.

Nothing else is changed: no case folding, no collapsing of inner spaces, no removal of inner blank lines.

## 3. The receipt

The receipt is a UTF-8 text file. The web tool names it `kvantix-seal-<first 12 hex of seal>.txt`.

```
KVANTIX SEAL v1
seal: <64 hex>
key: <32 hex>
sealed (your device clock, not a proof): <ISO 8601 UTC>
planned reveal: <YYYY-MM-DD>                         (optional line)
verify: https://kvantix.tech/playground/lock-your-prediction/
--- prediction (everything below this line, exactly) ---
<text>
```

The line after `text` ends with a single LF.

### Parsing a receipt

1. Convert CR LF and lone CR to LF.
2. Find the first occurrence of the separator `--- prediction (everything below this line, exactly) ---`. If it is missing, the receipt is invalid.
3. **Head** is everything before the separator. **Body** is everything after it, with one leading LF removed if present.
4. In the head, find a line matching `^key:\s*([0-9a-f]{32})\s*$` (case-insensitive, per line). If there is none, the receipt is invalid. The key is lowercased.
5. A `seal:` line (`^seal:\s*([0-9a-f]{64})\s*$`) is optional and informational only.
6. Compute the seal from the key and `normalise(body)`.

The seal written inside a receipt proves nothing by itself, because whoever wrote the receipt also wrote that line. **Always verify against the seal that was published**, copied from the original post, email or message.

Lines other than `key:` and `seal:` in the head are ignored. The sealing time and the planned reveal date are **not** part of the seal.

## 4. What a seal proves, and what it doesn't

| Proves | Doesn't prove |
|---|---|
| The revealed text is exactly the text that was sealed. | When it was sealed. The time comes from where and when the seal was published. |
| Nobody could read the text from the seal before the reveal. | That it was the only prediction. Sealing ten guesses and revealing the winner proves nothing. |
| | Who wrote it. |

A track record is only worth something if every sealed prediction is published, including the misses. That is the rule behind every forward test Kvantix runs.

## 5. Test vectors

[`test-vectors.json`](test-vectors.json) holds inputs that exercise every normalisation rule, with the expected normalised text and seal. Every implementation in this repository is tested against them in CI:

- the browser tool
- `verify.py`
- `verify.mjs`
- plain `printf | sha256sum`.

A new implementation is correct if it reproduces all of them.

## 6. Reference: shell

For a text that is already normalised:

```bash
printf 'kvantix-seal-v1\n%s\n%s' "$KEY" "$TEXT" | sha256sum
```

`printf %s` writes the text byte for byte. Do not use `echo`, which adds a line break.
