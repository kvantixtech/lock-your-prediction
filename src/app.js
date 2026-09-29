/* UI for the standalone page. All cryptography is in seal-core.js (KvxSeal). */
(function () {
  "use strict";
  var S = window.KvxSeal, $ = function (id) { return document.getElementById(id); };
  var ok = !!(window.crypto && crypto.subtle && crypto.getRandomValues && window.TextEncoder);
  if (!ok) { $("nosupport").hidden = false; $("go").disabled = true; $("check").disabled = true; return; }
  var last = null;

  function nowIso() { return new Date().toISOString().replace(/\.\d+Z$/, "Z"); }
  function postText(r) {
    return "I've sealed a prediction. Seal (SHA-256): " + r.seal +
      (r.reveal ? ". I'll reveal it on " + r.reveal : ". I'll reveal it later") +
      ". Anyone can check it: " + S.PAGE;
  }
  function copy(text, btn) {
    var done = function () { var o = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.textContent = o; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) {} document.body.removeChild(ta);
    }
  }
  function download(name, text) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  var txt = $("text"), count = $("count");
  txt.addEventListener("input", function () { count.textContent = S.normalise(txt.value).length + " / 2000"; });
  $("seal-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var text = S.normalise(txt.value), err = $("err");
    err.hidden = true;
    if (text.length < 1) { err.textContent = "Write your prediction first."; err.hidden = false; return; }
    if (text.length > 2000) { err.textContent = "Keep it under 2,000 characters."; err.hidden = false; return; }
    var key = S.newKey(), reveal = $("reveal").value || "";
    S.seal(key, text).then(function (h) {
      last = { seal: h, key: key, text: text, at: nowIso(), reveal: reveal };
      $("hash").textContent = h; $("at").textContent = last.at;
      $("out").hidden = false; $("state").textContent = "SEALED";
    });
  });
  $("copyhash").addEventListener("click", function () { if (last) copy(last.seal, this); });
  $("copypost").addEventListener("click", function () { if (last) copy(postText(last), this); });
  $("save").addEventListener("click", function () { if (last) download("kvantix-seal-" + last.seal.slice(0, 12) + ".txt", S.receipt(last)); });
  $("reset").addEventListener("click", function () {
    last = null; txt.value = ""; $("reveal").value = ""; count.textContent = "0 / 2000";
    $("out").hidden = true; $("state").textContent = "READY"; txt.focus();
  });

  $("file").addEventListener("change", function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader(); rd.onload = function () { $("receipt").value = String(rd.result || ""); }; rd.readAsText(f);
  });
  $("verify-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var out = $("verdict"), r = S.parseReceipt($("receipt").value);
    var want = String($("published").value || "").trim().toLowerCase();
    out.hidden = false; out.textContent = "";
    if (!r) { out.className = "verdict warn"; out.textContent = "That doesn't look like a Kvantix receipt. Paste the whole file, including the key line and the line that starts with “--- prediction”."; return; }
    var against = want || r.seal, note = want ? "" : " (checked against the seal written in the receipt: compare it with the one that was published)";
    if (!/^[0-9a-f]{64}$/.test(against)) { out.className = "verdict warn"; out.textContent = "Paste the published seal: 64 characters, 0–9 and a–f."; return; }
    S.seal(r.key, r.body).then(function (h) {
      var b = document.createElement("b");
      if (h === against) {
        out.className = "verdict good"; b.textContent = "MATCH. "; out.appendChild(b);
        out.appendChild(document.createTextNode("This exact text was sealed as " + h.slice(0, 16) + "…" + note + ". The seal proves what was written. When it was written is proven by where and when the seal was published."));
      } else {
        out.className = "verdict warn"; b.textContent = "NO MATCH. "; out.appendChild(b);
        out.appendChild(document.createTextNode("The text and key give " + h.slice(0, 16) + "…, not " + against.slice(0, 16) + "…. Either the text was changed (even one character or line break counts), or it is a different key or seal."));
      }
    });
  });
})();
