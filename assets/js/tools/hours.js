/* 824824 — Hours calculator (between times, between dates, add/subtract, add up a list). */
(function (root) {
  "use strict";
  var T = root.T824;

  T.hoursBetween = function (start, end, brk) {
    var a = T.parseClock(start), b = T.parseClock(end);
    if (a === null || b === null) return null;
    var span = T.span(a % 1440, b % 1440);
    var worked = Math.max(0, span - Math.max(0, T.num(brk, 0)));
    return { span: span, worked: worked, overnight: b <= a };
  };

  T.addClock = function (start, sign, h, m) {
    var a = T.parseClock(start);
    if (a === null) return null;
    var delta = (T.num(h, 0) * 60 + T.num(m, 0)) * (sign < 0 ? -1 : 1);
    var total = a + delta;
    return { minutes: ((total % 1440) + 1440) % 1440, dayOffset: Math.floor(total / 1440) };
  };

  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=hours]");
  if (!tool) return;
  var $ = function (s) { return T.$(s, tool); };

  T.tabs(tool);

  function twoTimes() {
    var r = T.hoursBetween($("#h-start").value, $("#h-end").value, $("#h-break").value);
    if (!r) { $("#h-out").textContent = "0:00"; $("#h-out-sub").textContent = "Enter a start and end time"; return; }
    $("#h-out").textContent = T.fmtDur(r.worked);
    $("#h-out-sub").textContent = T.fmtDec(r.worked) + " decimal hours, " + Math.round(r.worked) + " minutes" + (r.overnight ? ". Crosses midnight." : ".");
  }

  function twoDates() {
    var a = $("#h-dt-start").value, b = $("#h-dt-end").value;
    if (!a || !b) { $("#h-dt-out").textContent = "0:00"; $("#h-dt-sub").textContent = "Pick two dates and times"; return; }
    var ms = new Date(b).getTime() - new Date(a).getTime();
    if (isNaN(ms)) return;
    var min = Math.round(ms / 6e4);
    var abs = Math.abs(min);
    var d = Math.floor(abs / 1440), h = Math.floor((abs % 1440) / 60), m = abs % 60;
    $("#h-dt-out").textContent = (min < 0 ? "-" : "") + T.fmtDur(abs);
    $("#h-dt-sub").textContent = (min < 0 ? "The end is before the start. " : "") + d + " day" + (d === 1 ? "" : "s") + ", " + h + " hour" + (h === 1 ? "" : "s") + ", " + m + " minute" + (m === 1 ? "" : "s") + " = " + T.fmtDec(abs) + " hours";
  }

  function addSub() {
    var sign = $("#h-op").value === "-" ? -1 : 1;
    var r = T.addClock($("#h-base").value, sign, $("#h-add-h").value, $("#h-add-m").value);
    if (!r) { $("#h-add-out").textContent = "--:--"; return; }
    $("#h-add-out").textContent = T.fmtClock(r.minutes, true);
    var day = r.dayOffset === 0 ? "same day" : r.dayOffset === 1 ? "next day" : r.dayOffset === -1 ? "previous day" : (r.dayOffset > 0 ? "+" : "") + r.dayOffset + " days";
    $("#h-add-sub").textContent = T.fmtClock(r.minutes, false) + ", " + day;
  }

  function sumList() {
    var r = T.sumDurations($("#h-list").value);
    $("#h-sum-out").textContent = T.fmtDur(r.total);
    $("#h-sum-sub").textContent = T.fmtDec(r.total) + " decimal hours from " + r.count + " entr" + (r.count === 1 ? "y" : "ies") +
      (r.bad.length ? ". Couldn't read line " + r.bad.join(", ") + "." : ".");
  }

  function all() { twoTimes(); twoDates(); addSub(); sumList(); }
  T.onInput(tool, all);
  T.$$("[data-copy]", tool).forEach(function (b) {
    b.addEventListener("click", function () {
      var el = T.$(b.getAttribute("data-copy"), tool);
      var sub = el && el.nextElementSibling;
      T.copy((el ? el.textContent : "") + (sub ? " (" + sub.textContent + ")" : ""), "Result copied");
    });
  });
  var p = T.params();
  if (p.get("start")) $("#h-start").value = p.get("start");
  if (p.get("end")) $("#h-end").value = p.get("end");
  all();
})(typeof window !== "undefined" ? window : globalThis);
