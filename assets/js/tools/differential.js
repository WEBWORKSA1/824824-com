/* 824824 — Shift differential calculator. */
(function (root) {
  "use strict";
  var T = root.T824;

  /* Minutes of overlap between a shift [s, s+len) (minutes after midnight, may run past 1440)
     and a daily window [ws, we) that may itself cross midnight. */
  T.windowOverlap = function (s, len, ws, we) {
    if (ws === null || we === null || len <= 0) return 0;
    var wlen = T.span(ws, we);
    if (wlen >= 1440) return len;
    var total = 0;
    for (var day = -1; day <= 2; day++) {
      var a = day * 1440 + ws, b = a + wlen;
      total += Math.max(0, Math.min(s + len, b) - Math.max(s, a));
    }
    return Math.min(total, len);
  };

  /* i: { rate, start, end, brk, windows: [{start,end,type,value,enabled}], mode ('inside'|'majority'), weekend: {on,type,value}, shiftsPerWeek, weeksPerYear } */
  T.differential = function (i) {
    var rate = Math.max(0, T.num(i.rate));
    var s = T.parseClock(i.start), e = T.parseClock(i.end);
    if (s === null || e === null) return null;
    var span = T.span(s % 1440, e % 1440);
    var brk = Math.max(0, Math.min(span, T.num(i.brk)));
    var paid = span - brk;
    var factor = span > 0 ? paid / span : 0;
    var lines = [];
    var premium = 0;
    (i.windows || []).forEach(function (w) {
      if (!w.enabled) return;
      var ov = T.windowOverlap(s % 1440, span, T.parseClock(w.start), T.parseClock(w.end)) * factor;
      var qualifying = i.mode === "majority" ? (ov > paid / 2 ? paid : 0) : ov;
      var perHour = w.type === "pct" ? rate * T.num(w.value) / 100 : T.num(w.value);
      var amt = qualifying / 60 * perHour;
      premium += amt;
      lines.push({ label: w.label, minutes: qualifying, perHour: perHour, amount: amt });
    });
    if (i.weekend && i.weekend.on) {
      var wph = i.weekend.type === "pct" ? rate * T.num(i.weekend.value) / 100 : T.num(i.weekend.value);
      var wamt = paid / 60 * wph;
      premium += wamt;
      lines.push({ label: "Weekend", minutes: paid, perHour: wph, amount: wamt });
    }
    var base = paid / 60 * rate;
    var perShift = base + premium;
    var spw = Math.max(0, T.num(i.shiftsPerWeek, 0));
    var wpy = Math.max(0, T.num(i.weeksPerYear, 52));
    return {
      span: span, paid: paid, base: base, premium: premium, perShift: perShift, lines: lines,
      effective: paid > 0 ? perShift / (paid / 60) : 0,
      perWeek: perShift * spw, premiumPerYear: premium * spw * wpy, perYear: perShift * spw * wpy
    };
  };

  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=differential]");
  if (!tool) return;
  var $ = function (s) { return T.$(s, tool); };

  function read() {
    return {
      rate: $("#sd-rate").value, start: $("#sd-start").value, end: $("#sd-end").value, brk: $("#sd-brk").value,
      mode: $("#sd-mode").value, cur: $("#sd-cur").value,
      windows: [
        { label: "Evening", enabled: $("#sd-eve-on").checked, start: $("#sd-eve-s").value, end: $("#sd-eve-e").value, type: $("#sd-eve-t").value, value: $("#sd-eve-v").value },
        { label: "Night", enabled: $("#sd-night-on").checked, start: $("#sd-night-s").value, end: $("#sd-night-e").value, type: $("#sd-night-t").value, value: $("#sd-night-v").value }
      ],
      weekend: { on: $("#sd-wk-on").checked, type: $("#sd-wk-t").value, value: $("#sd-wk-v").value },
      shiftsPerWeek: $("#sd-spw").value, weeksPerYear: $("#sd-wpy").value
    };
  }

  function update() {
    var i = read();
    var r = T.differential(i);
    var cur = i.cur;
    if (!r) { $("#sd-total").textContent = T.fmtMoney(0, cur); $("#sd-total-sub").textContent = "Enter your shift times"; return; }
    $("#sd-total").textContent = T.fmtMoney(r.perShift, cur);
    $("#sd-total-sub").textContent = "per shift: " + T.fmtDur(r.paid) + " paid hours, " + T.fmtMoney(r.effective, cur) + " an hour on average";
    $("#sd-base").textContent = T.fmtMoney(r.base, cur);
    $("#sd-prem").innerHTML = T.fmtMoney(r.premium, cur) + '<span class="sub">' + r.lines.map(function (l) {
      return l.label + " " + T.fmtDur(l.minutes) + " h";
    }).join(", ") + "</span>";
    $("#sd-week").textContent = T.fmtMoney(r.perWeek, cur);
    $("#sd-year").innerHTML = T.fmtMoney(r.premiumPerYear, cur) + '<span class="sub">extra a year from differentials</span>';
    T.saveLocal("sd-state-v1", i);
  }

  var p = T.params();
  var saved = T.stateFromHash() || T.loadLocal("sd-state-v1");
  if (saved && !p.get("start")) {
    $("#sd-rate").value = saved.rate || ""; $("#sd-start").value = saved.start || "23:00"; $("#sd-end").value = saved.end || "07:00";
    $("#sd-brk").value = saved.brk || ""; $("#sd-mode").value = saved.mode || "inside"; $("#sd-cur").value = saved.cur || "$";
    if (saved.windows) {
      var w0 = saved.windows[0], w1 = saved.windows[1];
      $("#sd-eve-on").checked = !!w0.enabled; $("#sd-eve-s").value = w0.start; $("#sd-eve-e").value = w0.end; $("#sd-eve-t").value = w0.type; $("#sd-eve-v").value = w0.value;
      $("#sd-night-on").checked = !!w1.enabled; $("#sd-night-s").value = w1.start; $("#sd-night-e").value = w1.end; $("#sd-night-t").value = w1.type; $("#sd-night-v").value = w1.value;
    }
    if (saved.weekend) { $("#sd-wk-on").checked = !!saved.weekend.on; $("#sd-wk-t").value = saved.weekend.type; $("#sd-wk-v").value = saved.weekend.value; }
    $("#sd-spw").value = saved.shiftsPerWeek || ""; $("#sd-wpy").value = saved.weeksPerYear || "52";
  }
  if (p.get("start")) $("#sd-start").value = p.get("start");
  if (p.get("end")) $("#sd-end").value = p.get("end");
  T.onInput(tool, update);
  $("#sd-share").addEventListener("click", function () { T.copy(T.shareLink(read()), "Share link copied"); });
  update();
})(typeof window !== "undefined" ? window : globalThis);
