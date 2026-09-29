# Lock your prediction

[![tests](https://github.com/kvantixtech/lock-your-prediction/actions/workflows/tests.yml/badge.svg)](https://github.com/kvantixtech/lock-your-prediction/actions/workflows/tests.yml)
![spec](https://img.shields.io/badge/spec-kvantix--seal--v1-E7B24C)
![licence](https://img.shields.io/badge/licence-MIT-blue)

"I called it" is easy to say afterwards. This proves it.

Write a prediction and seal it in your browser with SHA-256 and a random secret key. Publish the seal now: a post, an email, a group chat. When the outcome is known, reveal the receipt, and anyone can check that the text is exactly what you sealed.

**Use it:** [kvantix.tech/playground/lock-your-prediction](https://kvantix.tech/playground/lock-your-prediction/), or open [`index.html`](index.html) from this repository. It is one file, works offline, and its own security policy blocks every network request.

```
seal = SHA-256( "kvantix-seal-v1\n" + key + "\n" + text )
```

## Verify a seal without trusting us

Four independent ways, all tested against the same [test vectors](test-vectors.json) on every commit:

| | Command |
|---|---|
| Any terminal | `printf 'kvantix-seal-v1\n%s\n%s' "$KEY" "$TEXT" \| sha256sum` |
| Python 3.9+ | `python3 verify.py check receipt.txt --seal <published seal>` |
| Node 18+ | `node verify.mjs check receipt.txt --seal <published seal>` |
| Browser | [`index.html`](index.html), panel 2 |

Always compare with the seal that was **published**, copied from the original post, not with the one written inside the receipt.

Seal from the command line (the receipt is written to a file and the seal is printed):

```bash
python3 verify.py seal "Denmark beats Norway 2-1 on 12 October." --reveal 2026-10-12
```

## What's here

| File | What it is |
|---|---|
| [`SPEC.md`](SPEC.md) | The seal, text normalisation, receipt format and parsing rules. Stable: a change would be `kvantix-seal-v2`. |
| [`test-vectors.json`](test-vectors.json) | 13 cases covering line breaks, Unicode NFC, what is and isn't trimmed, Danish letters and emoji. |
| `verify.py`, `verify.mjs` | Standalone verifiers and sealers. Standard library only, written separately so they check each other. |
| `seal-core.js`, `src/app.js`, `index.html` | The standalone page. `index.html` is built by `tools/build_page.py`, and CI fails if it doesn't match the sources. |
| [`site/kvx-seal.js`](site/kvx-seal.js) | The exact script served on kvantix.tech, with its [SHA-256](site/SHA256SUMS). CI runs it against the test vectors, and a daily job compares it byte for byte with the live file. |

## What a seal proves, and what it doesn't

A seal proves **what** was written. It does not prove **when**: that comes from where and when the seal was published. Your device's clock proves nothing.

It also doesn't prove that this was your only prediction. Someone who seals ten guesses and reveals the one that came true has proven nothing. A track record only counts if every sealed call is published, misses included.

That rule is the core of how [Kvantix](https://kvantix.tech) validates trading signals and forecasts. The same idea runs in public in our [weather forecast test](https://github.com/kvantixtech/weather-forecast-test).

## Privacy

The tool sends nothing and stores nothing: the text, the key and the seal stay in your browser, and Kvantix never sees them. The standalone `index.html` has no analytics and can't make network requests at all. The kvantix.tech page runs the same script, and the site counts page views with cookieless Umami. If you lose the receipt, nobody can recover it, including us.

## Licence

MIT. © 2026 Kvantix (CVR 46296036), Hjørring, Denmark · validation@kvantix.tech
