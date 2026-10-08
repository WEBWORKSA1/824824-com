/* 824824 — 24/7 staffing calculator. */
(function (root) {
  "use strict";
  var T = root.T824;

  /* i: { positions, hoursPerDay, daysPerWeek, shiftLength, avgHours, absence (%), rate, otMult, headcount } */
  T.staffing = function (i) {
    var positions = Math.max(0, T.num(i.positions, 1));
    var hpd = Math.min(24, Math.max(0, T.num(i.hoursPerDay, 24)));
    var dpw = Math.min(7, Math.max(0, T.num(i.daysPerWeek, 7)));
    var shiftLen = Math.max(1, T.num(i.shiftLength, 12));
    var avg = Math.max(1, T.num(i.avgHours, 40));
    var absence = Math.min(60, Math.max(0, T.num(i.absence, 10))) / 100;
    var rate = Math.max(0, T.num(i.rate, 0));
    var otMult = T.num(i.otMult, 1.5) || 1.5;
    var coverage = positions * hpd * dpw;
    var productive = avg * (1 - absence);
    var fte = productive > 0 ? coverage / productive : 0;
    var headcount = Math.ceil(fte - 1e-9);
    var shiftsPerWeek = coverage / shiftLen;
    var paidHours = fte * avg;
    var r = {
      coverage: coverage, productive: productive, fte: fte, headcount: headcount, shiftsPerWeek: shiftsPerWeek,
      paidHours: paidHours, weeklyCost: paidHours * rate, annualCost: paidHours * rate * 52,
      crews: hpd >= 24 && dpw >= 7 ? Math.round(168 / avg * 10) / 10 : null
    };
    var have = T.num(i.headcount, 0);
    if (have > 0) {
      var available = have * productive;
      r.have = have;
      r.gapHours = coverage - available;
      r.otCostWeekly = r.gapHours > 0 ? r.gapHours * rate * otMult : 0;
      r.otPerPerson = r.gapHours > 0 ? r.gapHours / have : 0;
    }
    return r;
  };

  T.teamBand = function (n) {
    if (n <= 10) return "1-10";
    if (n <= 50) return "11-50";
    if (n <= 200) return "51-200";
    if (n <= 500) return "201-500";
    return "500+";
  };

  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=staffing]");
  if (!tool) return;
  var $ = function (s) { return T.$(s, tool); };

  function read() {
    return {
      positions: $("#st-pos").value, hoursPerDay: $("#st-hpd").value, daysPerWeek: $("#st-dpw").value, shiftLength: $("#st-len").value,
      avgHours: $("#st-avg").value, absence: $("#st-abs").value, rate: $("#st-rate").value, otMult: $("#st-otm").value,
      headcount: $("#st-have").value, cur: $("#st-cur").value
    };
  }

  function update() {
    var i = read(), r = T.staffing(i), cur = i.cur;
    $("#st-head").textContent = String(r.headcount);
    $("#st-head-sub").textContent = "people (" + (Math.round(r.fte * 100) / 100) + " full-time equivalents) to cover " + Math.round(r.coverage) + " hours a week";
    $("#st-cov").textContent = Math.round(r.coverage) + " h";
    $("#st-shifts").textContent = String(Math.round(r.shiftsPerWeek * 10) / 10);
    $("#st-prod").textContent = (Math.round(r.productive * 10) / 10) + " h";
    $("#st-cost").innerHTML = T.num(i.rate) ? T.fmtMoney(r.weeklyCost, cur) + '<span class="sub">' + T.fmtMoney(r.annualCost, cur) + " a year</span>" : '<span class="sub">Add an hourly rate</span>';
    var gap = $("#st-gap");
    if (r.have) {
      gap.hidden = false;
      if (r.gapHours > 0.5) {
        gap.className = "warnings";
        gap.innerHTML = "<li>With " + r.have + " people you're short about " + Math.round(r.gapHours) + " hours a week, roughly " +
          (Math.round(r.otPerPerson * 10) / 10) + " hours of overtime per person" + (T.num(i.rate) ? ", costing about " + T.fmtMoney(r.otCostWeekly, cur) + " a week at the overtime rate" : "") + ".</li>";
      } else {
        gap.className = "warnings";
        gap.innerHTML = '<li class="info">With ' + r.have + " people you have about " + Math.round(-r.gapHours) + " spare productive hours a week to absorb absences.</li>";
      }
    } else {
      gap.hidden = true;
    }
    var band = T.teamBand(r.headcount);
    $("#st-match").href = "get-matched.html?team_size=" + encodeURIComponent(band) + (T.num(i.hoursPerDay) >= 24 ? "&pattern=247" : "");
    T.saveLocal("st-state-v1", i);
  }

  var saved = T.stateFromHash() || T.loadLocal("st-state-v1");
  if (saved) {
    var map = { positions: "#st-pos", hoursPerDay: "#st-hpd", daysPerWeek: "#st-dpw", shiftLength: "#st-len", avgHours: "#st-avg", absence: "#st-abs",
      rate: "#st-rate", otMult: "#st-otm", headcount: "#st-have", cur: "#st-cur" };
    Object.keys(map).forEach(function (k) { if (saved[k] !== undefined) $(map[k]).value = saved[k]; });
  }
  T.$$("[data-avg]", tool).forEach(function (b) { b.addEventListener("click", function () { $("#st-avg").value = b.getAttribute("data-avg"); update(); }); });
  T.onInput(tool, update);
  $("#st-share").addEventListener("click", function () { T.copy(T.shareLink(read()), "Share link copied"); });
  update();
})(typeof window !== "undefined" ? window : globalThis);
