/* Kvantix seal v1: browser core (also loads in Node 18+ for the tests). SPEC.md.
   Uses Web Crypto (crypto.subtle) and crypto.getRandomValues. Sends nothing anywhere. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KvxSeal = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var PREFIX = "kvantix-seal-v1\n";
  var SEP = "--- prediction (everything below this line, exactly) ---";
  var PAGE = "https://kvantix.tech/playground/lock-your-prediction/";

  function webcrypto() {
    if (typeof crypto !== "undefined" && crypto.subtle) return crypto;
    if (typeof require === "function") return require("crypto").webcrypto; // Node 18
    throw new Error("Web Crypto is not available");
  }
  function hex(buf) {
    var b = new Uint8Array(buf), s = "";
    for (var i = 0; i < b.length; i++) s += ("0" + b[i].toString(16)).slice(-2);
    return s;
  }
  function normalise(t) {
    t = String(t == null ? "" : t).replace(/\r\n?/g, "\n");
    if (t.normalize) t = t.normalize("NFC");
    return t.trim();
  }
  function newKey() {
    var b = new Uint8Array(16);
    webcrypto().getRandomValues(b);
    return hex(b.buffer);
  }
  function seal(key, text) {
    if (!/^[0-9a-f]{32}$/.test(key)) return Promise.reject(new Error("key must be 32 lowercase hex characters"));
    var data = new TextEncoder().encode(PREFIX + key + "\n" + normalise(text));
    return webcrypto().subtle.digest("SHA-256", data).then(hex);
  }
  function parseReceipt(raw) {
    raw = String(raw || "").replace(/\r\n?/g, "\n");
    var i = raw.indexOf(SEP);
    if (i < 0) return null;
    var head = raw.slice(0, i), body = raw.slice(i + SEP.length).replace(/^\n/, "");
    var km = head.match(/^key:\s*([0-9a-f]{32})\s*$/mi), sm = head.match(/^seal:\s*([0-9a-f]{64})\s*$/mi);
    if (!km) return null;
    return { key: km[1].toLowerCase(), body: body, seal: sm ? sm[1].toLowerCase() : "" };
  }
  function receipt(r) {
    return "KVANTIX SEAL v1\n" +
      "seal: " + r.seal + "\n" +
      "key: " + r.key + "\n" +
      "sealed (your device clock, not a proof): " + r.at + "\n" +
      (r.reveal ? "planned reveal: " + r.reveal + "\n" : "") +
      "verify: " + PAGE + "\n" +
      SEP + "\n" + normalise(r.text) + "\n";
  }
  return { PREFIX: PREFIX, SEP: SEP, PAGE: PAGE, normalise: normalise, newKey: newKey, seal: seal,
           parseReceipt: parseReceipt, receipt: receipt };
});
