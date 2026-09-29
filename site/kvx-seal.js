/* ============================================================
   KVANTIX · Data Playground · "Lock your prediction" · v2026-09-28
   Upload to /wp-content/uploads/kvx/kvx-seal.js
   Runs entirely in the visitor's browser. The prediction, the key and the
   seal are never sent anywhere and never stored by Kvantix.

   seal = SHA-256( "kvantix-seal-v1\n" + key + "\n" + text )
     key  = 32 hex characters from crypto.getRandomValues (stops guessing)
     text = the prediction, line breaks as \n, Unicode NFC, trimmed
   Verify without us:
     printf 'kvantix-seal-v1\n%s\n%s' "$KEY" "$TEXT" | sha256sum
   ============================================================ */
(function () {
  "use strict";
  var PREFIX = "kvantix-seal-v1\n", SEP = "--- prediction (everything below this line, exactly) ---";
  var PAGE = "https://kvantix.tech/playground/lock-your-prediction/";

  function init() {
    var root = document.getElementById("kvx-seal");
    if (!root || root.dataset.ready) return;
    root.dataset.ready = "1";
    var $ = function (id) { return document.getElementById(id); };
    var ok = !!(window.crypto && crypto.subtle && crypto.getRandomValues && window.TextEncoder);
    if (!ok) { $("kvx-seal-nosupport").hidden = false; $("kvx-seal-go").disabled = true; $("kvx-seal-check").disabled = true; return; }
    var last = null;

    function norm(t) { t = String(t || "").replace(/\r\n?/g, "\n"); if (t.normalize) t = t.normalize("NFC"); return t.trim(); }
    function hex(buf) { var b = new Uint8Array(buf), s = ""; for (var i = 0; i < b.length; i++) s += ("0" + b[i].toString(16)).slice(-2); return s; }
    function sha(str) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(hex); }
    function newKey() { var b = new Uint8Array(16); crypto.getRandomValues(b); return hex(b.buffer); }
    function nowIso() { return new Date().toISOString().replace(/\.\d+Z$/, "Z"); }
    function seal(key, text) { return sha(PREFIX + key + "\n" + norm(text)); }

    function receipt(r) {
      return "KVANTIX SEAL v1\n" +
        "seal: " + r.seal + "\n" +
        "key: " + r.key + "\n" +
        "sealed (your device clock, not a proof): " + r.at + "\n" +
        (r.reveal ? "planned reveal: " + r.reveal + "\n" : "") +
        "verify: " + PAGE + "\n" +
        SEP + "\n" + r.text + "\n";
    }
    function postText(r) {
      return "I've sealed a prediction. Seal (SHA-256): " + r.seal +
        (r.reveal ? ". I'll reveal it on " + r.reveal : ". I'll reveal it later") +
        ". Anyone can check it: " + PAGE;
    }
    function copyText(text, btn) {
      var done = function () { var o = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.textContent = o; }, 1600); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
      function fallback() { var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) {} document.body.removeChild(ta); }
    }
    function download(name, text) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    /* ---------- 1 · seal ---------- */
    var txt = $("kvx-seal-text"), count = $("kvx-seal-count");
    txt.addEventListener("input", function () { count.textContent = norm(txt.value).length + " / 2000"; });
    $("kvx-seal-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var text = norm(txt.value), err = $("kvx-seal-err");
      err.hidden = true;
      if (text.length < 3) { err.textContent = "Write your prediction first."; err.hidden = false; return; }
      if (text.length > 2000) { err.textContent = "Keep it under 2,000 characters."; err.hidden = false; return; }
      var key = newKey(), reveal = $("kvx-seal-reveal").value || "";
      seal(key, text).then(function (h) {
        last = { seal: h, key: key, text: text, at: nowIso(), reveal: reveal };
        $("kvx-seal-hash").textContent = h;
        $("kvx-seal-at").textContent = last.at;
        $("kvx-seal-out").hidden = false;
        $("kvx-seal-state").textContent = "SEALED";
        $("kvx-seal-out").scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
    $("kvx-seal-copyhash").addEventListener("click", function () { if (last) copyText(last.seal, this); });
    $("kvx-seal-copypost").addEventListener("click", function () { if (last) copyText(postText(last), this); });
    $("kvx-seal-save").addEventListener("click", function () { if (last) download("kvantix-seal-" + last.seal.slice(0, 12) + ".txt", receipt(last)); });
    $("kvx-seal-reset").addEventListener("click", function () {
      last = null; txt.value = ""; $("kvx-seal-reveal").value = ""; count.textContent = "0 / 2000";
      $("kvx-seal-out").hidden = true; $("kvx-seal-state").textContent = "READY"; txt.focus();
    });

    /* ---------- 2 · verify ---------- */
    function parse(raw) {
      raw = String(raw || "").replace(/\r\n?/g, "\n");
      var i = raw.indexOf(SEP);
      if (i < 0) return null;
      var head = raw.slice(0, i), body = raw.slice(i + SEP.length).replace(/^\n/, "");
      var km = head.match(/^key:\s*([0-9a-f]{32})\s*$/mi), sm = head.match(/^seal:\s*([0-9a-f]{64})\s*$/mi);
      if (!km) return null;
      return { key: km[1].toLowerCase(), text: body, seal: sm ? sm[1].toLowerCase() : "" };
    }
    $("kvx-seal-file").addEventListener("change", function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { $("kvx-seal-receipt").value = String(rd.result || ""); }; rd.readAsText(f);
    });
    $("kvx-verify-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var out = $("kvx-verify-out"), r = parse($("kvx-seal-receipt").value);
      var want = String($("kvx-verify-seal").value || "").trim().toLowerCase();
      out.hidden = false;
      if (!r) { out.className = "kvx-tk-verdict warn"; out.textContent = "That doesn't look like a Kvantix receipt. Paste the whole file, including the key line and the line that starts with “--- prediction”."; return; }
      var against = want || r.seal, note = want ? "" : " (checked against the seal written in the receipt: compare it with the one that was published)";
      if (!/^[0-9a-f]{64}$/.test(against)) { out.className = "kvx-tk-verdict warn"; out.textContent = "Paste the published seal: 64 characters, 0–9 and a–f."; return; }
      seal(r.key, r.text).then(function (h) {
        out.textContent = "";
        var head = document.createElement("b");
        if (h === against) {
          out.className = "kvx-tk-verdict good";
          head.textContent = "MATCH. ";
          out.appendChild(head);
          out.appendChild(document.createTextNode("This exact text was sealed as " + h.slice(0, 16) + "…" + note + ". The seal proves what was written. When it was written is proven by where and when the seal was published."));
        } else {
          out.className = "kvx-tk-verdict warn";
          head.textContent = "NO MATCH. ";
          out.appendChild(head);
          out.appendChild(document.createTextNode("The text and key give " + h.slice(0, 16) + "…, not " + against.slice(0, 16) + "…. Either the text was changed (even one character or line break counts), or it is a different key or seal."));
        }
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
