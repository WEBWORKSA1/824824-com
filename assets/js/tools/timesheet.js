/* 824824 — Printable timesheet generator. */
(function (root) {
  "use strict";
  var T = root.T824;
  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=timesheet]");
  if (!tool) return;
  var $ = function (s) { return T.$(s, tool); };

  function esc(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function render() {
    var company = $("#ts-company").value, name = $("#ts-name").value, start = $("#ts-start").value || T.weekStart(T.today(), 0);
    var weeks = +$("#ts-weeks").value, split = $("#ts-split").checked, notes = $("#ts-notes").checked, rate = $("#ts-rate").checked;
    var head = "<tr><th>Day</th><th>Date</th><th>Time in</th><th>Time out</th>" + (split ? "<th>Time in</th><th>Time out</th>" : "") +
      "<th>Unpaid break</th><th>Total hours</th>" + (notes ? "<th>Notes</th>" : "") + "</tr>";
    var cols = 6 + (split ? 2 : 0) + (notes ? 1 : 0);
    var html = "";
    for (var w = 0; w < weeks; w++) {
      var body = "";
      for (var d = 0; d < 7; d++) {
        var iso = T.addDays(start, w * 7 + d);
        body += "<tr><td>" + T.DOW_LONG[T.weekday(iso)] + "</td><td>" + T.fmtDate(iso, "short").slice(4) + "</td><td></td><td></td>" + (split ? "<td></td><td></td>" : "") +
          "<td></td><td></td>" + (notes ? "<td></td>" : "") + "</tr>";
      }
      body += '<tr class="ts-total"><td colspan="' + (cols - (notes ? 2 : 1)) + '">Week ' + (w + 1) + " total hours</td><td></td>" + (notes ? "<td></td>" : "") + "</tr>";
      html += '<table class="ts-table"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
    }
    $("#ts-sheet").innerHTML =
      '<div class="ts-head"><div><p class="ts-title">Timesheet</p><p>' + (company ? esc(company) : "Company: ______________________") + "</p></div>" +
      "<div><p>Employee: " + (name ? esc(name) : "______________________") + "</p><p>Period: " + T.fmtDate(start) + " to " + T.fmtDate(T.addDays(start, weeks * 7 - 1)) + "</p>" +
      (rate ? "<p>Hourly rate: ________ &nbsp; Overtime rate: ________</p>" : "") + "</div></div>" + html +
      '<div class="ts-sign"><div>Total hours for period: ________</div><div>Overtime hours: ________</div><div>Employee signature and date</div><div>Supervisor signature and date</div></div>' +
      '<p class="ts-foot">Free printable timesheet from 824824.com</p>';
  }

  $("#ts-start").value = T.weekStart(T.today(), 0);
  T.onInput(tool, render);
  $("#ts-print").addEventListener("click", function () { T.track("tool_print", { tool: "timesheet" }); window.print(); });
  render();
})(typeof window !== "undefined" ? window : globalThis);
