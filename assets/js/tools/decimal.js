/* 824824 — Decimal hours converter. */
(function (root) {
  "use strict";
  var T = root.T824;

  T.toDecimalHours = function (h, m) { return T.num(h) + T.num(m) / 60; };
  T.fromDecimalHours = function (dec) {
    var total = Math.round(Math.abs(T.num(dec)) * 60);
    return { h: Math.floor(total / 60), m: total % 60, sign: T.num(dec) < 0 ? -1 : 1 };
  };

  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=decimal]");
  if (!tool) return;
  var $ = function (s) { return T.$(s, tool); };

  function update() {
    var dec = T.toDecimalHours($("#dh-h").value, $("#dh-m").value);
    $("#dh-out").textContent = dec.toFixed(2);
    $("#dh-out-sub").textContent = "decimal hours (" + dec.toFixed(4).replace(/0+$/, "").replace(/\.$/, "") + " to 4 places), or " + Math.round(dec * 60) + " minutes";
    var back = T.fromDecimalHours($("#dh-dec").value);
    $("#dh-back").textContent = (back.sign < 0 ? "-" : "") + back.h + ":" + T.pad(back.m);
    $("#dh-back-sub").textContent = back.h + " hour" + (back.h === 1 ? "" : "s") + " and " + back.m + " minute" + (back.m === 1 ? "" : "s");
    var r = T.sumDurations($("#dh-list").value);
    var lines = $("#dh-list").value.split(/\n/).filter(function (l) { return l.trim(); });
    $("#dh-list-out").value = lines.map(function (l) {
      var v = T.parseEntry(l);
      return v === null ? l.trim() + "  ->  ?" : l.trim() + "  ->  " + (v / 60).toFixed(2);
    }).join("\n");
    $("#dh-sum").textContent = (r.total / 60).toFixed(2) + " hours (" + T.fmtDur(r.total) + ") from " + r.count + " entr" + (r.count === 1 ? "y" : "ies");
  }

  function table() {
    var cells = "";
    for (var m = 0; m < 60; m++) {
      cells += "<tr><td>" + m + " min</td><td class=\"num\">" + (m / 60).toFixed(2) + "</td><td class=\"num\">" + (m / 60).toFixed(4) + "</td></tr>";
    }
    $("#dh-table").innerHTML = cells;
  }

  T.onInput(tool, update);
  table();
  update();
})(typeof window !== "undefined" ? window : globalThis);
