/* 824824 — Overtime calculator with the US regular-rate method. */
(function (root) {
  "use strict";
  var T = root.T824;

  /* i: { rate, hours, threshold, mult, dtHours, dtMult, diffHours, diffType ('flat'|'pct'), diffValue, bonus, method ('regular'|'simple'), otOverride } */
  T.overtimePay = function (i) {
    var rate = Math.max(0, T.num(i.rate));
    var H = Math.max(0, T.num(i.hours));
    var thr = Math.max(0, T.num(i.threshold, 40));
    var mult = T.num(i.mult, 1.5) || 1.5;
    var dtMult = T.num(i.dtMult, 2) || 2;
    var dtH = Math.min(H, Math.max(0, T.num(i.dtHours)));
    var otH = i.otOverride !== undefined && i.otOverride !== "" && i.otOverride !== null
      ? Math.max(0, T.num(i.otOverride)) : Math.max(0, H - thr - dtH);
    otH = Math.min(otH, H - dtH);
    var regH = H - otH - dtH;
    var diffH = Math.min(H, Math.max(0, T.num(i.diffHours)));
    var diffPerHour = i.diffType === "pct" ? rate * T.num(i.diffValue) / 100 : T.num(i.diffValue);
    var diffPay = diffH * diffPerHour;
    var bonus = Math.max(0, T.num(i.bonus));

    var straight = rate * H + diffPay + bonus;
    var regularRate = H > 0 ? straight / H : 0;
    var premiumReg = otH * (mult - 1) * regularRate + dtH * (dtMult - 1) * regularRate;
    var totalReg = straight + premiumReg;

    var totalSimple = rate * regH + rate * mult * otH + rate * dtMult * dtH + diffPay + bonus;

    var method = i.method === "simple" ? "simple" : "regular";
    var total = method === "simple" ? totalSimple : totalReg;
    return {
      regH: regH, otH: otH, dtH: dtH, hours: H,
      basePay: rate * regH, otPay: method === "simple" ? rate * mult * otH : otH * rate + otH * (mult - 1) * regularRate,
      dtPay: method === "simple" ? rate * dtMult * dtH : dtH * rate + dtH * (dtMult - 1) * regularRate,
      diffPay: diffPay, bonus: bonus, straight: straight, regularRate: regularRate,
      otRate: method === "simple" ? rate * mult : rate + (mult - 1) * regularRate,
      total: total, totalSimple: totalSimple, totalRegular: totalReg,
      gap: totalReg - totalSimple, effective: H > 0 ? total / H : 0, method: method
    };
  };

  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=overtime]");
  if (!tool) return;
  var $ = function (s) { return T.$(s, tool); };

  function read() {
    return {
      rate: $("#ot-rate").value, hours: $("#ot-hours").value, threshold: $("#ot-thr").value === "custom" ? $("#ot-thr-custom").value : $("#ot-thr").value,
      mult: $("#ot-mult").value, dtHours: $("#ot-dt").value, dtMult: $("#ot-dtm").value,
      diffHours: $("#ot-diff-h").value, diffType: $("#ot-diff-type").value, diffValue: $("#ot-diff-v").value,
      bonus: $("#ot-bonus").value, method: $("#ot-method").value, cur: $("#ot-cur").value
    };
  }

  function update() {
    var i = read();
    $("#ot-thr-custom-wrap").hidden = $("#ot-thr").value !== "custom";
    var r = T.overtimePay(i);
    var cur = i.cur;
    $("#ot-total").textContent = T.fmtMoney(r.total, cur);
    $("#ot-total-sub").textContent = "for " + r.hours + " hours worked this week, " + T.fmtMoney(r.effective, cur) + " an hour on average";
    $("#ot-out-reg").innerHTML = r.regH.toFixed(2) + ' h<span class="sub">' + T.fmtMoney(r.basePay, cur) + "</span>";
    $("#ot-out-ot").innerHTML = r.otH.toFixed(2) + ' h<span class="sub">' + T.fmtMoney(r.otPay, cur) + " at " + T.fmtMoney(r.otRate, cur) + "/h</span>";
    $("#ot-out-dt").innerHTML = r.dtH.toFixed(2) + ' h<span class="sub">' + T.fmtMoney(r.dtPay, cur) + "</span>";
    $("#ot-out-rr").innerHTML = T.fmtMoney(r.regularRate, cur) + '<span class="sub">regular rate per hour</span>';
    var gap = $("#ot-gap");
    if (r.gap > 0.005 && (T.num(i.diffHours) > 0 || T.num(i.bonus) > 0)) {
      gap.hidden = false;
      gap.textContent = "Paying overtime on the base rate alone would come to " + T.fmtMoney(r.totalSimple, cur) + ", which is " + T.fmtMoney(r.gap, cur) +
        " less than the regular-rate method US federal law uses when differentials or non-discretionary bonuses are paid.";
    } else {
      gap.hidden = true;
    }
    T.saveLocal("ot-state-v1", i);
  }

  var saved = T.stateFromHash() || T.loadLocal("ot-state-v1");
  if (saved) {
    var map = { rate: "#ot-rate", hours: "#ot-hours", mult: "#ot-mult", dtHours: "#ot-dt", dtMult: "#ot-dtm", diffHours: "#ot-diff-h", diffType: "#ot-diff-type",
      diffValue: "#ot-diff-v", bonus: "#ot-bonus", method: "#ot-method", cur: "#ot-cur" };
    Object.keys(map).forEach(function (k) { if (saved[k] !== undefined) $(map[k]).value = saved[k]; });
    if (["40", "44", "48"].indexOf(String(saved.threshold)) !== -1) $("#ot-thr").value = String(saved.threshold);
    else if (saved.threshold) { $("#ot-thr").value = "custom"; $("#ot-thr-custom").value = saved.threshold; }
  }
  T.onInput(tool, update);
  $("#ot-share").addEventListener("click", function () { T.copy(T.shareLink(read()), "Share link copied"); });
  $("#ot-copy").addEventListener("click", function () {
    T.copy("Weekly pay: " + $("#ot-total").textContent + " (" + $("#ot-total-sub").textContent + ")", "Result copied");
  });
  update();
})(typeof window !== "undefined" ? window : globalThis);
