/* 824824 — Time card calculator. */
(function (root) {
  "use strict";
  var T = root.T824;

  T.OT_RULES = {
    none: { label: "No overtime" },
    us: { label: "US federal: over 40 hours a week", weekly: 40 },
    ca: { label: "California: daily 8 and 12, weekly 40, seventh day", daily: 8, dailyDT: 12, weekly: 40, seventh: true },
    aknv: { label: "Alaska or Nevada: daily 8, weekly 40", daily: 8, weekly: 40 },
    co: { label: "Colorado: daily 12, weekly 40", daily: 12, weekly: 40 },
    cafed: { label: "Canada federal: daily 8, weekly 40", daily: 8, weekly: 40 },
    on: { label: "Ontario: over 44 hours a week", weekly: 44 },
    qc: { label: "Quebec: over 40 hours a week", weekly: 40 },
    bc: { label: "British Columbia: daily 8 and 12, weekly 40", daily: 8, dailyDT: 12, weekly: 40 },
    ab: { label: "Alberta: over 8 a day or 44 a week, whichever is greater", greater: true, daily: 8, weekly: 44 },
    custom: { label: "Custom thresholds" }
  };

  T.resolveRule = function (s) {
    if (s.rule !== "custom") return T.OT_RULES[s.rule] || {};
    var c = s.custom || {};
    var r = {};
    if (T.num(c.daily, 0) > 0) r.daily = T.num(c.daily);
    if (T.num(c.dailyDT, 0) > 0) r.dailyDT = T.num(c.dailyDT);
    if (T.num(c.weekly, 0) > 0) r.weekly = T.num(c.weekly);
    return r;
  };

  /* Core time card math. All values in minutes. */
  T.timecard = function (s) {
    var days = Math.max(1, Math.min(31, Math.round(T.num(s.days, 7))));
    var rule = T.resolveRule(s);
    var inc = T.num(s.round, 0);
    var res = { rows: [], weeks: [], warnings: [], totals: { worked: 0, reg: 0, ot: 0, dt: 0, pay: 0 } };
    var shifts = [];

    (s.rows || []).forEach(function (r, idx) {
      var a = T.parseClock(r.in), b = T.parseClock(r.out);
      if (a === null || b === null) { res.rows[idx] = null; return; }
      var rawStart = r.d * 1440 + a;
      var rawEnd = rawStart + T.span(a % 1440, b % 1440);
      var startAbs = T.roundTo(rawStart, inc);
      var endAbs = T.roundTo(rawEnd, inc);
      var dur = Math.max(0, endAbs - startAbs);
      var brk = Math.max(0, T.num(r.brk, 0));
      var worked = Math.max(0, dur - brk);
      var sh = { idx: idx, d: r.d, startAbs: startAbs, endAbs: endAbs, dur: dur, brk: brk, worked: worked };
      shifts.push(sh);
      res.rows[idx] = sh;
      if (brk > dur && dur > 0) res.warnings.push({ type: "error", text: "A break is longer than the shift on " + T.fmtDate(T.addDays(s.start, r.d), "short") + "." });
      if (worked > 16 * 60) res.warnings.push({ type: "error", text: "More than 16 hours worked on " + T.fmtDate(T.addDays(s.start, r.d), "short") + ". Check the times." });
    });

    var dayMin = [];
    for (var i = 0; i < days; i++) dayMin.push(0);
    var spill = 0;
    function addDay(d, m) {
      if (d >= days) { spill += m; d = days - 1; }
      if (d < 0) d = 0;
      dayMin[d] += m;
    }
    shifts.forEach(function (sh) {
      if (s.attr === "split" && sh.dur > 0) {
        var t = sh.startAbs;
        while (t < sh.endAbs) {
          var di = Math.floor(t / 1440);
          var part = Math.min(sh.endAbs, (di + 1) * 1440) - t;
          addDay(di, Math.max(0, part - sh.brk * part / sh.dur));
          t += part;
        }
      } else {
        addDay(sh.d, sh.worked);
      }
    });
    if (spill > 0.5) res.warnings.push({ type: "info", text: T.fmtDur(spill) + " worked after midnight at the end of the period is counted in this period's last day." });

    var otm = T.num(s.otm, 1.5), dtm = T.num(s.dtm, 2), rate = T.num(s.rate, 0);
    for (var w = 0; w * 7 < days; w++) {
      var from = w * 7, to = Math.min(days, from + 7);
      var wk = { start: T.addDays(s.start, from), days: [], reg: 0, ot: 0, dt: 0, total: 0, pay: 0 };
      var workedDays = 0, wTotal = 0;
      for (var d = from; d < to; d++) { if (dayMin[d] > 0) workedDays++; wTotal += dayMin[d]; }
      var full = to - from === 7;
      var runReg = 0;
      for (d = from; d < to; d++) {
        var m = dayMin[d], reg = m, ot = 0, dt = 0;
        if (!rule.greater) {
          if (rule.seventh && full && workedDays === 7 && d === to - 1) {
            ot = Math.min(m, 480); dt = Math.max(0, m - 480); reg = 0;
          } else {
            if (rule.dailyDT) dt = Math.max(0, m - rule.dailyDT * 60);
            if (rule.daily) ot = Math.max(0, Math.min(m, rule.dailyDT ? rule.dailyDT * 60 : Infinity) - rule.daily * 60);
            reg = m - ot - dt;
          }
          if (rule.weekly) {
            var room = Math.max(0, rule.weekly * 60 - runReg);
            if (reg > room) { ot += reg - room; reg = room; }
            runReg += reg;
          }
        }
        wk.days.push({ d: d, m: m, reg: reg, ot: ot, dt: dt });
      }
      if (rule.greater) {
        var dailyOT = 0;
        wk.days.forEach(function (x) { dailyOT += Math.max(0, x.m - rule.daily * 60); });
        var weeklyOT = Math.max(0, wTotal - rule.weekly * 60);
        var run = 0;
        wk.days.forEach(function (x) {
          if (dailyOT >= weeklyOT) { x.ot = Math.max(0, x.m - rule.daily * 60); x.reg = x.m - x.ot; }
          else { x.reg = Math.min(x.m, Math.max(0, rule.weekly * 60 - run)); x.ot = x.m - x.reg; run += x.m; }
        });
      }
      wk.days.forEach(function (x) { wk.reg += x.reg; wk.ot += x.ot; wk.dt += x.dt; wk.total += x.m; });
      wk.pay = (wk.reg + wk.ot * otm + wk.dt * dtm) / 60 * rate;
      res.weeks.push(wk);
      res.totals.reg += wk.reg; res.totals.ot += wk.ot; res.totals.dt += wk.dt; res.totals.worked += wk.total; res.totals.pay += wk.pay;
    }

    var rest = T.num(s.rest, 0);
    var sorted = shifts.filter(function (x) { return x.dur > 0; }).sort(function (a, b) { return a.startAbs - b.startAbs; });
    for (var k = 1; k < sorted.length; k++) {
      var p = sorted[k - 1], n = sorted[k];
      var gap = n.startAbs - p.endAbs;
      if (gap < 0) res.warnings.push({ type: "error", text: "Two shifts overlap around " + T.fmtDate(T.addDays(s.start, n.d), "short") + "." });
      else if (rest && n.d !== p.d && gap < rest) {
        res.warnings.push({ type: "error", text: "Only " + T.fmtDur(gap) + " off between the shift ending " + T.fmtDate(T.addDays(s.start, Math.floor(p.endAbs / 1440)), "short") + " at " + T.fmtClock(p.endAbs, true) + " and the next one. Many rules call for at least " + T.fmtDur(rest).replace(":00", "") + " hours of rest." });
      }
    }
    res.days = dayMin;
    res.rule = rule;
    return res;
  };

  /* ---------------------------------------------------------- UI */
  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=time-card]");
  if (!tool) return;

  var KEY = "tc-state-v1";
  var $ = function (s) { return T.$(s, tool); };
  var tbody = $("#tc-rows");

  function defaults() {
    var start = T.weekStart(T.today(), 0);
    return { name: "", start: start, period: "7", days: 7, rows: blankRows(7), round: "0", attr: "start", rule: "us",
      custom: { daily: "", dailyDT: "", weekly: "40" }, rate: "", cur: "$", otm: "1.5", dtm: "2", rest: "660" };
  }
  function blankRows(n) {
    var rows = [];
    for (var d = 0; d < n; d++) rows.push({ d: d, in: "", out: "", brk: "" });
    return rows;
  }

  var state = T.stateFromHash() || T.loadLocal(KEY) || defaults();
  if (!state.rows || !state.start) state = defaults();

  function syncControls() {
    $("#tc-name").value = state.name || "";
    $("#tc-start").value = state.start;
    $("#tc-period").value = state.period || "7";
    $("#tc-days").value = state.days;
    $("#tc-days-wrap").hidden = state.period !== "custom";
    $("#tc-rate").value = state.rate;
    $("#tc-cur").value = state.cur;
    $("#tc-rule").value = state.rule;
    $("#tc-otm").value = state.otm;
    $("#tc-dtm").value = state.dtm;
    $("#tc-round").value = state.round;
    $("#tc-attr").value = state.attr;
    $("#tc-rest").value = state.rest;
    $("#tc-c-daily").value = state.custom.daily;
    $("#tc-c-dt").value = state.custom.dailyDT;
    $("#tc-c-weekly").value = state.custom.weekly;
    $("#tc-custom").hidden = state.rule !== "custom";
  }

  function resizeRows(n) {
    var keep = state.rows.filter(function (r) { return r.d < n; });
    for (var d = 0; d < n; d++) {
      if (!keep.some(function (r) { return r.d === d; })) keep.push({ d: d, in: "", out: "", brk: "" });
    }
    keep.sort(function (a, b) { return a.d - b.d; });
    state.rows = keep;
    state.days = n;
  }

  function renderRows() {
    tbody.innerHTML = "";
    var seen = {};
    state.rows.forEach(function (r, i) {
      var iso = T.addDays(state.start, r.d);
      var extra = !!seen[r.d];
      seen[r.d] = true;
      var tr = document.createElement("tr");
      tr.dataset.i = String(i);
      if (extra) tr.className = "tc-sub";
      var dayLabel = extra ? "<td class=\"tc-day\">Another shift<small>" + T.fmtDate(iso, "short") + "</small></td>"
        : "<td class=\"tc-day\">" + T.DOW_LONG[T.weekday(iso)] + "<small>" + T.fmtDate(iso, "short").slice(4) + "</small></td>";
      tr.innerHTML = dayLabel +
        '<td data-label="Time in"><input type="time" data-f="in" aria-label="Time in, ' + T.fmtDate(iso, "short") + '"></td>' +
        '<td data-label="Time out"><input type="time" data-f="out" aria-label="Time out, ' + T.fmtDate(iso, "short") + '"></td>' +
        '<td data-label="Unpaid break (min)"><input type="number" data-f="brk" min="0" max="600" step="1" inputmode="numeric" placeholder="0" aria-label="Unpaid break minutes, ' + T.fmtDate(iso, "short") + '"></td>' +
        '<td class="tc-worked" data-label="Worked"><span>0:00</span><small>0.00</small></td>' +
        '<td class="tc-actions">' + (extra
          ? '<button type="button" class="row-btn" data-act="del" aria-label="Remove this shift" title="Remove this shift">&times;</button>'
          : '<button type="button" class="row-btn" data-act="add" aria-label="Add another shift on ' + T.fmtDate(iso, "short") + '" title="Add a split shift">+</button>') + "</td>";
      tbody.appendChild(tr);
      T.$("[data-f=in]", tr).value = r.in || "";
      T.$("[data-f=out]", tr).value = r.out || "";
      T.$("[data-f=brk]", tr).value = r.brk || "";
    });
  }

  var last = null;
  function update() {
    var res = T.timecard(state);
    last = res;
    T.$$("tr", tbody).forEach(function (tr) {
      var sh = res.rows[+tr.dataset.i];
      var cell = T.$(".tc-worked", tr);
      cell.firstChild.textContent = sh ? T.fmtDur(sh.worked) : "0:00";
      cell.lastChild.textContent = sh ? T.fmtDec(sh.worked) : "0.00";
    });
    var t = res.totals;
    $("#tc-total").textContent = T.fmtDur(t.worked);
    $("#tc-total-dec").textContent = T.fmtDec(t.worked) + " decimal hours";
    $("#tc-reg").innerHTML = T.fmtDur(t.reg) + '<span class="sub">' + T.fmtDec(t.reg) + " h</span>";
    $("#tc-ot").innerHTML = T.fmtDur(t.ot) + '<span class="sub">' + T.fmtDec(t.ot) + " h</span>";
    $("#tc-dt").innerHTML = T.fmtDur(t.dt) + '<span class="sub">' + T.fmtDec(t.dt) + " h</span>";
    $("#tc-dt-wrap").hidden = !(t.dt > 0 || (res.rule && res.rule.dailyDT));
    var rate = T.num(state.rate, 0);
    $("#tc-pay").innerHTML = rate ? T.fmtMoney(t.pay, state.cur) + '<span class="sub">at ' + T.fmtMoney(rate, state.cur) + "/h</span>"
      : '<span class="sub">Add an hourly rate to see pay</span>';

    var weeksBox = $("#tc-weeks");
    if (res.weeks.length > 1 || t.ot > 0) {
      var rows = res.weeks.map(function (w) {
        return "<tr><td>" + T.fmtDate(w.start, "short") + "</td><td class=\"num\">" + T.fmtDur(w.reg) + "</td><td class=\"num\">" + T.fmtDur(w.ot) +
          "</td><td class=\"num\">" + T.fmtDur(w.dt) + "</td><td class=\"num\">" + T.fmtDur(w.total) + "</td><td class=\"num\">" + (rate ? T.fmtMoney(w.pay, state.cur) : "—") + "</td></tr>";
      }).join("");
      weeksBox.innerHTML = '<div class="table-wrap" style="margin-top:14px"><table class="grid-table"><thead><tr><th>Week of</th><th class="num">Regular</th><th class="num">Overtime</th><th class="num">Double</th><th class="num">Total</th><th class="num">Pay</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    } else {
      weeksBox.innerHTML = "";
    }
    var warn = $("#tc-warn");
    warn.innerHTML = "";
    res.warnings.forEach(function (w) {
      var li = document.createElement("li");
      if (w.type === "info") li.className = "info";
      li.textContent = w.text;
      warn.appendChild(li);
    });
    T.saveLocal(KEY, state);
  }

  function readTable(e) {
    var input = e.target.closest("[data-f]");
    if (!input) return;
    var tr = input.closest("tr");
    var r = state.rows[+tr.dataset.i];
    r[input.dataset.f] = input.value;
    update();
  }

  tbody.addEventListener("input", readTable);
  tbody.addEventListener("change", readTable);
  tbody.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var i = +b.closest("tr").dataset.i;
    if (b.dataset.act === "add") {
      state.rows.splice(i + 1, 0, { d: state.rows[i].d, in: "", out: "", brk: "" });
    } else {
      state.rows.splice(i, 1);
    }
    renderRows();
    update();
    var focusRow = T.$$("tr", tbody)[b.dataset.act === "add" ? i + 1 : Math.max(0, i - 1)];
    if (focusRow) T.$("input", focusRow).focus();
  });

  function readControls() {
    state.name = $("#tc-name").value;
    var newStart = $("#tc-start").value || state.start;
    state.start = newStart;
    state.period = $("#tc-period").value;
    var n = state.period === "custom" ? Math.max(1, Math.min(31, T.num($("#tc-days").value, 7))) : +state.period;
    $("#tc-days-wrap").hidden = state.period !== "custom";
    var structural = n !== state.days;
    if (structural) resizeRows(n);
    state.rate = $("#tc-rate").value;
    state.cur = $("#tc-cur").value;
    state.rule = $("#tc-rule").value;
    state.otm = $("#tc-otm").value;
    state.dtm = $("#tc-dtm").value;
    state.round = $("#tc-round").value;
    state.attr = $("#tc-attr").value;
    state.rest = $("#tc-rest").value;
    state.custom = { daily: $("#tc-c-daily").value, dailyDT: $("#tc-c-dt").value, weekly: $("#tc-c-weekly").value };
    $("#tc-custom").hidden = state.rule !== "custom";
    return structural;
  }

  T.$$(".tc-control", tool).forEach(function (el) {
    el.addEventListener("change", function () {
      var structural = readControls();
      if (structural || el.id === "tc-start") renderRows();
      update();
    });
    if (el.tagName === "INPUT" && el.type !== "date") el.addEventListener("input", function () { readControls(); update(); });
  });

  $("#tc-fill").addEventListener("click", function () {
    var src = state.rows.filter(function (r) { return r.in && r.out; })[0];
    if (!src) { T.toast("Enter the first day's times first"); return; }
    var n = 0;
    state.rows.forEach(function (r, i) {
      if (r === src || state.rows.indexOf(r) !== i) return;
      var dow = T.weekday(T.addDays(state.start, r.d));
      var primary = state.rows.findIndex(function (x) { return x.d === r.d; }) === i;
      if (primary && dow >= 1 && dow <= 5 && !r.in && !r.out) { r.in = src.in; r.out = src.out; r.brk = src.brk; n++; }
    });
    renderRows();
    update();
    T.toast(n ? "Filled " + n + " weekday" + (n > 1 ? "s" : "") : "No empty weekdays to fill");
  });

  $("#tc-example").addEventListener("click", function () {
    state.rows = blankRows(state.days);
    var plan = [[1, "19:00", "07:30", "30"], [2, "19:00", "07:30", "30"], [4, "19:00", "07:30", "30"], [5, "18:45", "07:15", "30"]];
    plan.forEach(function (p) { if (p[0] < state.days) { var r = state.rows[p[0]]; r.in = p[1]; r.out = p[2]; r.brk = p[3]; } });
    if (!state.rate) state.rate = "28.50";
    syncControls();
    renderRows();
    update();
    T.toast("Example: four 12-hour night shifts");
  });

  $("#tc-clear").addEventListener("click", function () {
    if (!confirm("Clear every time on this card?")) return;
    state.rows = blankRows(state.days);
    renderRows();
    update();
  });

  function reportHTML() {
    var res = last || T.timecard(state);
    var end = T.addDays(state.start, state.days - 1);
    var rows = state.rows.map(function (r, i) {
      var sh = res.rows[i];
      if (!sh) return "";
      var iso = T.addDays(state.start, r.d);
      return "<tr><td>" + T.fmtDate(iso, "short") + "</td><td>" + T.fmtClock(sh.startAbs, true) + "</td><td>" + T.fmtClock(sh.endAbs, true) +
        "</td><td>" + (sh.brk || 0) + "</td><td>" + T.fmtDur(sh.worked) + "</td><td>" + T.fmtDec(sh.worked) + "</td></tr>";
    }).join("");
    var t = res.totals, rate = T.num(state.rate, 0);
    return "<h2>Time card" + (state.name ? ": " + escapeHtml(state.name) : "") + "</h2>" +
      "<p>Pay period " + T.fmtDate(state.start) + " to " + T.fmtDate(end) + ". Overtime rule: " + escapeHtml(T.OT_RULES[state.rule].label) + ".</p>" +
      "<table><thead><tr><th>Date</th><th>In</th><th>Out</th><th>Break (min)</th><th>Worked</th><th>Decimal</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<p><strong>Total " + T.fmtDur(t.worked) + " (" + T.fmtDec(t.worked) + " h)</strong>. Regular " + T.fmtDur(t.reg) + ", overtime " + T.fmtDur(t.ot) +
      ", double time " + T.fmtDur(t.dt) + "." + (rate ? " Gross pay " + T.fmtMoney(t.pay, state.cur) + " at " + T.fmtMoney(rate, state.cur) + "/h." : "") + "</p>" +
      '<div class="sig"><div>Employee signature and date</div><div>Supervisor signature and date</div></div>' +
      "<p style=\"margin-top:24px;font-size:9pt\">Made with the free time card calculator at 824824.com</p>";
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  $("#tc-print").addEventListener("click", function () {
    $("#tc-report").innerHTML = reportHTML();
    T.track("tool_print", { tool: "time-card" });
    window.print();
  });

  $("#tc-csv").addEventListener("click", function () {
    var res = last || T.timecard(state);
    var rows = [["Date", "Day", "Time in", "Time out", "Unpaid break (min)", "Worked (h:mm)", "Worked (decimal)"]];
    state.rows.forEach(function (r, i) {
      var sh = res.rows[i];
      if (!sh) return;
      var iso = T.addDays(state.start, r.d);
      rows.push([iso, T.DOW[T.weekday(iso)], T.fmtClock(sh.startAbs, true), T.fmtClock(sh.endAbs, true), sh.brk || 0, T.fmtDur(sh.worked), T.fmtDec(sh.worked)]);
    });
    rows.push([]);
    rows.push(["Week of", "Regular", "Overtime", "Double time", "Total", "Pay"]);
    res.weeks.forEach(function (w) { rows.push([w.start, T.fmtDec(w.reg), T.fmtDec(w.ot), T.fmtDec(w.dt), T.fmtDec(w.total), w.pay ? w.pay.toFixed(2) : ""]); });
    T.download("time-card-" + state.start + ".csv", "text/csv;charset=utf-8", T.csv(rows));
    T.track("tool_export", { tool: "time-card", format: "csv" });
  });

  $("#tc-share").addEventListener("click", function () {
    T.copy(T.shareLink(state), "Share link copied");
    T.track("tool_share", { tool: "time-card" });
  });

  $("#tc-copy").addEventListener("click", function () {
    var res = last || T.timecard(state), t = res.totals;
    var text = "Time card " + T.fmtDate(state.start) + ": total " + T.fmtDur(t.worked) + " (" + T.fmtDec(t.worked) + " h), regular " + T.fmtDec(t.reg) +
      " h, overtime " + T.fmtDec(t.ot) + " h" + (t.dt ? ", double time " + T.fmtDec(t.dt) + " h" : "") + (T.num(state.rate) ? ", gross pay " + T.fmtMoney(t.pay, state.cur) : "") + ".";
    T.copy(text, "Summary copied");
  });

  syncControls();
  renderRows();
  update();
})(typeof window !== "undefined" ? window : globalThis);
