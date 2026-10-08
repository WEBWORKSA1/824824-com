/* 824824 — Hourly and salary converter. */
(function (root) {
  "use strict";
  var T = root.T824;

  T.PERIODS = [
    ["hourly", "Hourly"], ["daily", "Daily"], ["weekly", "Weekly"], ["biweekly", "Every two weeks"],
    ["semimonthly", "Twice a month"], ["monthly", "Monthly"], ["annual", "Yearly"]
  ];

  /* i: { amount, period, hoursPerWeek, daysPerWeek, weeksPerYear, unpaidWeeks, otHours, otMult } */
  T.convertPay = function (i) {
    var amt = Math.max(0, T.num(i.amount));
    var hpw = Math.max(0.01, T.num(i.hoursPerWeek, 40));
    var dpw = Math.max(1, T.num(i.daysPerWeek, 5));
    var wpy = Math.max(1, T.num(i.weeksPerYear, 52));
    var paidWeeks = Math.max(1, wpy - Math.max(0, T.num(i.unpaidWeeks, 0)));
    var annual;
    switch (i.period) {
      case "hourly": annual = amt * hpw * paidWeeks; break;
      case "daily": annual = amt * dpw * paidWeeks; break;
      case "weekly": annual = amt * paidWeeks; break;
      case "biweekly": annual = amt * paidWeeks / 2; break;
      case "semimonthly": annual = amt * 24; break;
      case "monthly": annual = amt * 12; break;
      default: annual = amt;
    }
    var hourly = annual / (hpw * paidWeeks);
    var otAnnual = Math.max(0, T.num(i.otHours)) * hourly * (T.num(i.otMult, 1.5) || 1.5) * paidWeeks;
    var out = {
      hourly: hourly, daily: hourly * hpw / dpw, weekly: hourly * hpw, biweekly: hourly * hpw * 2,
      semimonthly: annual / 24, monthly: annual / 12, annual: annual
    };
    return { base: out, otAnnual: otAnnual, withOt: annual + otAnnual, paidWeeks: paidWeeks };
  };

  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=salary]");
  if (!tool) return;
  var $ = function (s) { return T.$(s, tool); };

  function read() {
    return {
      amount: $("#sal-amount").value, period: $("#sal-period").value, hoursPerWeek: $("#sal-hpw").value, daysPerWeek: $("#sal-dpw").value,
      weeksPerYear: $("#sal-wpy").value, unpaidWeeks: $("#sal-unpaid").value, otHours: $("#sal-ot").value, otMult: $("#sal-otm").value, cur: $("#sal-cur").value
    };
  }

  function update() {
    var i = read();
    var r = T.convertPay(i);
    var cur = i.cur;
    $("#sal-annual").textContent = T.fmtMoney(r.base.annual, cur);
    $("#sal-annual-sub").textContent = "a year, or " + T.fmtMoney(r.base.hourly, cur) + " an hour at " + T.num(i.hoursPerWeek, 40) + " hours a week for " + r.paidWeeks + " paid weeks";
    var body = $("#sal-table");
    body.innerHTML = T.PERIODS.map(function (p) {
      var withOt = r.otAnnual > 0 ? (p[0] === "hourly" ? "" : T.fmtMoney(r.base[p[0]] * r.withOt / r.base.annual, cur)) : "";
      return "<tr" + (p[0] === i.period ? ' style="font-weight:700"' : "") + "><td>" + p[1] + "</td><td class=\"num\">" + T.fmtMoney(r.base[p[0]], cur) + "</td>" +
        (r.otAnnual > 0 ? "<td class=\"num\">" + (withOt || "—") + "</td>" : "") + "</tr>";
    }).join("");
    $("#sal-ot-head").hidden = !(r.otAnnual > 0);
    T.$$("[data-hpw]", tool).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-hpw") === String(T.num(i.hoursPerWeek)))); });
    T.saveLocal("sal-state-v1", i);
  }

  var saved = T.stateFromHash() || T.loadLocal("sal-state-v1");
  if (saved) {
    ["amount", "period", "hpw", "dpw", "wpy", "unpaid", "ot", "otm", "cur"].forEach(function (k, idx) {
      var key = ["amount", "period", "hoursPerWeek", "daysPerWeek", "weeksPerYear", "unpaidWeeks", "otHours", "otMult", "cur"][idx];
      if (saved[key] !== undefined) $("#sal-" + k).value = saved[key];
    });
  }
  T.$$("[data-hpw]", tool).forEach(function (b) {
    b.addEventListener("click", function () { $("#sal-hpw").value = b.getAttribute("data-hpw"); update(); });
  });
  T.onInput(tool, update);
  $("#sal-share").addEventListener("click", function () { T.copy(T.shareLink(read()), "Share link copied"); });
  update();
})(typeof window !== "undefined" ? window : globalThis);
