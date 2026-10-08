/* 824824 — Shift pattern generator: rotations to calendars, coverage and .ics export. */
(function (root) {
  "use strict";
  var T = root.T824;

  var DAY12 = { label: "Day", start: "07:00", hours: 12 };
  var NIGHT12 = { label: "Night", start: "19:00", hours: 12 };

  T.PATTERNS = {
    pitman: { name: "2-2-3 (Pitman), 12-hour", seq: "DDOODDDOODDOOO", shifts: { D: DAY12 }, kind: true, teams: { A: 0, B: 7 },
      about: "Work 2, off 2, work 3, off 2, work 2, off 3. Two day teams and two night teams cover 24/7." },
    panama: { name: "Panama (2-2-3 with day and night blocks)", seq: "DDOODDDOODDOOONNOONNNOONNOOO", shifts: { D: DAY12, N: NIGHT12 }, teams: { A: 0, B: 7, C: 14, D: 21 },
      about: "The 2-2-3 cadence, switching between two weeks of days and two weeks of nights. Four teams cover 24/7." },
    dupont: { name: "DuPont, 12-hour", seq: "NNNNOOODDDONNNOOODDDDOOOOOOO", shifts: { D: DAY12, N: NIGHT12 }, teams: { A: 0, B: 7, C: 14, D: 21 },
      about: "4 nights, 3 off, 3 days, 1 off, 3 nights, 3 off, 4 days, 7 off. Four teams cover 24/7." },
    fouron: { name: "4-on-4-off, 12-hour (fixed shift)", seq: "DDDDOOOO", shifts: { D: DAY12 }, kind: true, teams: { A: 0, B: 4 },
      about: "Four 12-hour shifts, then four days off. Two day teams and two night teams cover 24/7." },
    fouronrot: { name: "4-on-4-off, rotating days and nights", seq: "DDDDOOOONNNNOOOO", shifts: { D: DAY12, N: NIGHT12 }, teams: { A: 0, B: 4, C: 8, D: 12 },
      about: "Four days, four off, four nights, four off. Four teams cover 24/7." },
    continental: { name: "Continental, 8-hour forward rotation", seq: "MMAANNNOOMMAAANNOOMMMAANNOOO",
      shifts: { M: { label: "Morning", start: "07:00", hours: 8 }, A: { label: "Afternoon", start: "15:00", hours: 8 }, N: { label: "Night", start: "23:00", hours: 8 } },
      teams: { A: 0, B: 7, C: 14, D: 21 }, about: "Mornings, then afternoons, then nights, always rotating forward. Four teams cover 24/7." },
    f2448: { name: "24/48 (24 on, 48 off)", seq: "XOO", shifts: { X: { label: "24-hour", start: "07:00", hours: 24 } }, teams: { A: 0, B: 1, C: 2 },
      about: "One 24-hour shift, then two days off. Three platoons cover 24/7." },
    f4896: { name: "48/96 (two 24s, four off)", seq: "XXOOOO", shifts: { X: { label: "24-hour", start: "07:00", hours: 24 } }, teams: { A: 0, B: 2, C: 4 },
      about: "Two back-to-back 24-hour shifts, then four days off. Three platoons cover 24/7." },
    fourtens: { name: "4-3 (four 10-hour days)", seq: "DDDDOOO", shifts: { D: { label: "Day", start: "07:00", hours: 10 } }, kind: true, weekly: true, teams: { A: 0 },
      about: "Four 10-hour days and three days off every week. Start the cycle on the first workday of your week." },
    fivetwo: { name: "5-on-2-off, 8-hour", seq: "DDDDDOO", shifts: { D: { label: "Day", start: "09:00", hours: 8 } }, kind: true, weekly: true, teams: { A: 0 },
      about: "The standard week. Start the cycle on your first workday." },
    nineeighty: { name: "9/80 compressed schedule", seq: "DDDDHOODDDDOOO", shifts: { D: { label: "9-hour day", start: "08:00", hours: 9 }, H: { label: "8-hour day", start: "08:00", hours: 8 } },
      weekly: true, teams: { A: 0, B: 7 }, about: "80 hours in nine workdays over two weeks, with every other Friday off. Start on a Monday." },
    custom: { name: "Custom pattern", seq: "DDNNOOOO", shifts: {}, teams: { A: 0, B: 2, C: 4, D: 6 },
      about: "Type your own cycle: D day, E evening, N night, X 24-hour, O day off." }
  };

  T.DEFAULT_SHIFTS = {
    D: DAY12, N: NIGHT12, E: { label: "Evening", start: "15:00", hours: 8 }, M: { label: "Morning", start: "06:00", hours: 8 },
    A: { label: "Afternoon", start: "14:00", hours: 8 }, X: { label: "24-hour", start: "07:00", hours: 24 }, H: { label: "Short day", start: "08:00", hours: 8 }
  };

  T.normalizeSeq = function (str) {
    return String(str || "").toUpperCase().replace(/[^DENXMAHO10.\-]/g, "").replace(/1/g, "D").replace(/[0.\-]/g, "O").slice(0, 84);
  };

  function mod(a, n) { return ((a % n) + n) % n; }

  T.codeOn = function (seq, cycleStart, offset, iso) {
    return seq.charAt(mod(T.dayDiff(cycleStart, iso) + offset, seq.length));
  };

  T.patternStats = function (seq, shifts) {
    var L = seq.length, on = 0, hours = 0, nights = 0;
    for (var i = 0; i < L; i++) {
      var c = seq.charAt(i);
      if (c === "O") continue;
      on++;
      hours += T.num((shifts[c] || {}).hours, 0);
      if (c === "N") nights++;
    }
    function longest(isOn) {
      var best = 0, run = 0;
      for (var j = 0; j < L * 2; j++) {
        var hit = (seq.charAt(j % L) !== "O") === isOn;
        run = hit ? run + 1 : 0;
        best = Math.max(best, Math.min(run, L));
      }
      return best;
    }
    var avg = L ? hours / L * 7 : 0;
    return { length: L, on: on, off: L - on, hours: hours, avg: avg, nights: nights, longestOn: longest(true), longestOff: longest(false) };
  };

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  /* Average weekly overtime (hours over `limit` per workweek) for each possible workweek start day.
     Shifts count toward the workweek in which they start. */
  T.overtimeByWeekStart = function (seq, shifts, cycleStart, offset, limit) {
    var L = seq.length;
    var span = L * 7 / gcd(L, 7);
    var out = [];
    for (var dow = 0; dow < 7; dow++) {
      var first = cycleStart;
      while (T.weekday(first) !== dow) first = T.addDays(first, 1);
      var weeks = span / 7, ot = 0, min = Infinity, max = 0;
      for (var w = 0; w < weeks; w++) {
        var h = 0;
        for (var d = 0; d < 7; d++) {
          var c = T.codeOn(seq, cycleStart, offset, T.addDays(first, w * 7 + d));
          if (c !== "O") h += T.num((shifts[c] || {}).hours, 0);
        }
        ot += Math.max(0, h - limit);
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
      out.push({ dow: dow, avgOt: ot / weeks, minWeek: min, maxWeek: max });
    }
    return out;
  };

  /* For each date, which shift codes are worked across all teams. */
  T.coverage = function (seq, teams, cycleStart, from, days) {
    var rows = [];
    for (var d = 0; d < days; d++) {
      var iso = T.addDays(from, d);
      var codes = {};
      Object.keys(teams).forEach(function (t) {
        var c = T.codeOn(seq, cycleStart, teams[t], iso);
        codes[t] = c;
      });
      rows.push({ date: iso, codes: codes });
    }
    return rows;
  };

  T.icsFor = function (opts) {
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//824824//Shift Pattern Generator//EN", "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:" + opts.calName];
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    for (var d = 0; d < opts.days; d++) {
      var iso = T.addDays(opts.from, d);
      var c = T.codeOn(opts.seq, opts.cycleStart, opts.offset, iso);
      if (c === "O") continue;
      var sh = opts.shifts[c];
      var start = T.parseClock(sh.start) || 0;
      var endMin = start + Math.round(T.num(sh.hours, 8) * 60);
      var endIso = T.addDays(iso, Math.floor(endMin / 1440));
      var fmt = function (dateIso, min) { return dateIso.replace(/-/g, "") + "T" + T.pad(Math.floor((min % 1440) / 60)) + T.pad(min % 60) + "00"; };
      lines.push("BEGIN:VEVENT", "UID:824824-" + iso + "-" + opts.team + "-" + c + "-" + opts.seq.length + ".shift",
        "DTSTAMP:" + stamp, "DTSTART:" + fmt(iso, start), "DTEND:" + fmt(endIso, endMin),
        "SUMMARY:" + sh.label + " shift" + (opts.team ? " (Team " + opts.team + ")" : ""), "TRANSP:OPAQUE", "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  };

  /* ---------------------------------------------------------- UI */
  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=pattern]");
  if (!tool) return;
  var $ = function (s) { return T.$(s, tool); };
  var KEY = "sp-state-v1";

  function defaults() {
    var today = T.today();
    return { p: "pitman", start: T.weekStart(today, 1), team: "A", kind: "D", custom: "DDNNOOOO", shifts: {}, months: "3",
      from: today.slice(0, 7), wstart: "0" };
  }
  var state = T.stateFromHash() || T.loadLocal(KEY) || defaults();
  if (!T.PATTERNS[state.p]) state = defaults();
  var prm = T.params();
  if (prm.get("pattern") && T.PATTERNS[prm.get("pattern")]) state.p = prm.get("pattern");

  // month options
  (function () {
    var sel = $("#sp-from");
    var now = new Date();
    for (var k = -3; k <= 21; k++) {
      var d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + k, 1));
      var val = d.getUTCFullYear() + "-" + T.pad(d.getUTCMonth() + 1);
      var o = document.createElement("option");
      o.value = val;
      o.textContent = T.MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
      sel.appendChild(o);
    }
  })();
  (function () {
    var sel = $("#sp-pattern");
    Object.keys(T.PATTERNS).forEach(function (k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = T.PATTERNS[k].name;
      sel.appendChild(o);
    });
  })();

  function current() {
    var P = T.PATTERNS[state.p];
    var seq = state.p === "custom" ? (T.normalizeSeq(state.custom) || "DO") : P.seq;
    if (P.kind && state.kind === "N") seq = seq.replace(/D/g, "N");
    var shifts = {};
    seq.split("").forEach(function (c) {
      if (c === "O" || shifts[c]) return;
      var base = (P.shifts && P.shifts[c]) || T.DEFAULT_SHIFTS[c] || DAY12;
      if (P.kind && state.kind === "N" && c === "N") {
        var dh = P.shifts.D.hours;
        base = { label: "Night", start: dh >= 12 ? "19:00" : dh >= 10 ? "21:00" : "23:00", hours: dh };
      }
      var o = (state.shifts && state.shifts[state.p + ":" + c]) || {};
      shifts[c] = { label: base.label, start: o.start || base.start, hours: o.hours !== undefined && o.hours !== "" ? T.num(o.hours, base.hours) : base.hours };
    });
    var teams = state.p === "custom" ? autoTeams(seq) : P.teams;
    return { P: P, seq: seq, shifts: shifts, teams: teams };
  }

  function autoTeams(seq) {
    var L = seq.length, n = Math.min(6, Math.max(1, Math.round(L / Math.max(1, (seq.replace(/O/g, "").length)))));
    var teams = {}, letters = "ABCDEF";
    for (var i = 0; i < n; i++) teams[letters[i]] = Math.round(i * L / n);
    return teams;
  }

  function syncControls() {
    var cur = current();
    $("#sp-pattern").value = state.p;
    $("#sp-start").value = state.start;
    $("#sp-custom").value = state.custom;
    $("#sp-custom-wrap").hidden = state.p !== "custom";
    $("#sp-kind-wrap").hidden = !cur.P.kind;
    $("#sp-kind").value = state.kind;
    $("#sp-months").value = state.months;
    $("#sp-from").value = state.from;
    $("#sp-wstart").value = state.wstart;
    var teamSel = $("#sp-team");
    teamSel.innerHTML = "";
    Object.keys(cur.teams).forEach(function (t) {
      var o = document.createElement("option");
      o.value = t;
      o.textContent = Object.keys(cur.teams).length > 1 ? "Team " + t : "My schedule";
      teamSel.appendChild(o);
    });
    if (!cur.teams[state.team]) state.team = Object.keys(cur.teams)[0];
    teamSel.value = state.team;
    $("#sp-about").textContent = cur.P.about;
    renderTimes(cur);
  }

  function renderTimes(cur) {
    var box = $("#sp-times");
    box.innerHTML = "";
    Object.keys(cur.shifts).forEach(function (c) {
      var s = cur.shifts[c];
      var row = document.createElement("div");
      row.className = "grid-3";
      row.style.marginBottom = "10px";
      row.innerHTML = '<p class="field-label" style="align-self:end;margin:0 0 12px"><span class="legend"><span><i class="sc-' + c + '"></i>' + s.label + " (" + c + ")</span></span></p>" +
        '<label class="field"><span>Starts</span><input type="time" data-shift="' + c + '" data-k="start" value="' + s.start + '"></label>' +
        '<label class="field"><span>Hours</span><input type="number" min="1" max="24" step="0.25" data-shift="' + c + '" data-k="hours" value="' + s.hours + '"></label>';
      box.appendChild(row);
    });
  }

  function monthGrid(year, month, cur, wstart) {
    var first = year + "-" + T.pad(month + 1) + "-01";
    var daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    var lead = (T.weekday(first) - wstart + 7) % 7;
    var today = T.today();
    var html = '<div class="cal"><h3>' + T.MONTHS[month] + " " + year + '</h3><div class="cal-grid">';
    for (var i = 0; i < 7; i++) html += '<div class="cal-dow">' + T.DOW[(i + wstart) % 7] + "</div>";
    for (i = 0; i < lead; i++) html += '<div class="cal-day blank" aria-hidden="true"></div>';
    var worked = 0;
    for (var d = 1; d <= daysIn; d++) {
      var iso = year + "-" + T.pad(month + 1) + "-" + T.pad(d);
      var c = T.codeOn(cur.seq, state.start, cur.teams[state.team] || 0, iso);
      if (c !== "O") worked++;
      var label = c === "O" ? "Off" : cur.shifts[c].label + " shift";
      html += '<div class="cal-day sc-' + c + (iso === today ? " today" : "") + '" title="' + T.fmtDate(iso) + ": " + label + '"><span class="d">' + d +
        '</span><span class="c" aria-label="' + label + '">' + (c === "O" ? "" : c) + "</span></div>";
    }
    html += '</div><p class="hint" style="margin:8px 0 0">' + worked + " shift" + (worked === 1 ? "" : "s") + " this month</p></div>";
    return html;
  }

  function update() {
    var cur = current();
    var stats = T.patternStats(cur.seq, cur.shifts);
    var offset = cur.teams[state.team] || 0;
    var wstart = +state.wstart;

    $("#sp-avg").textContent = (Math.round(stats.avg * 10) / 10).toString();
    $("#sp-avg-sub").textContent = "hours a week on average: " + stats.on + " shifts and " + stats.hours + " hours every " + stats.length + " days";
    $("#sp-len").textContent = stats.length + " days";
    $("#sp-on").textContent = stats.longestOn + (stats.longestOn === 1 ? " day" : " days");
    $("#sp-off").textContent = stats.longestOff + (stats.longestOff === 1 ? " day" : " days");
    var teamsNeeded = stats.avg > 0 ? 168 / stats.avg : 0;
    $("#sp-teams").textContent = teamsNeeded ? (Math.round(teamsNeeded * 10) / 10).toString() : "—";

    var ot = T.overtimeByWeekStart(cur.seq, cur.shifts, state.start, offset, 40);
    var mine = ot[wstart];
    $("#sp-ot").innerHTML = (Math.round(mine.avgOt * 10) / 10) + ' h<span class="sub">a week over 40 (workweek starts ' + T.DOW_LONG[wstart] + ")</span>";
    var rows = ot.map(function (o) {
      return "<tr" + (o.dow === wstart ? ' style="font-weight:700"' : "") + "><td>" + T.DOW_LONG[o.dow] + '</td><td class="num">' + o.minWeek + "–" + o.maxWeek +
        ' h</td><td class="num">' + (Math.round(o.avgOt * 10) / 10) + " h</td></tr>";
    }).join("");
    $("#sp-ot-table").innerHTML = "<thead><tr><th>Payroll week starts</th><th class=\"num\">Weekly hours</th><th class=\"num\">Avg overtime a week</th></tr></thead><tbody>" + rows + "</tbody>";

    // legend
    $("#sp-legend").innerHTML = Object.keys(cur.shifts).map(function (c) {
      var s = cur.shifts[c];
      var end = (T.parseClock(s.start) || 0) + Math.round(s.hours * 60);
      return '<span><i class="sc-' + c + '"></i>' + c + " = " + s.label + " " + s.start + "–" + T.fmtClock(end, true) + "</span>";
    }).join("") + '<span><i class="sc-O"></i>Blank = off</span>';

    // calendars
    var months = +state.months;
    var parts = state.from.split("-");
    var y = +parts[0], m = +parts[1] - 1;
    var html = "";
    for (var k = 0; k < months; k++) {
      var mm = m + k;
      html += monthGrid(y + Math.floor(mm / 12), mm % 12, cur, wstart);
    }
    $("#sp-cal").innerHTML = html;

    // coverage
    var teamKeys = Object.keys(cur.teams);
    var covWrap = $("#sp-coverage-wrap");
    if (teamKeys.length > 1) {
      covWrap.hidden = false;
      var days = Math.min(28, Math.max(14, cur.seq.length));
      var cov = T.coverage(cur.seq, cur.teams, state.start, state.start, days);
      var head = "<tr><th>Team</th>" + cov.map(function (r) {
        return "<th>" + T.DOW[T.weekday(r.date)].charAt(0) + "<br>" + +r.date.slice(8) + "</th>";
      }).join("") + "</tr>";
      var body = teamKeys.map(function (t) {
        return "<tr><td>Team " + t + "</td>" + cov.map(function (r) {
          var c = r.codes[t];
          return '<td class="c sc-' + c + '">' + (c === "O" ? "" : c) + "</td>";
        }).join("") + "</tr>";
      }).join("");
      $("#sp-coverage").innerHTML = "<thead>" + head + "</thead><tbody>" + body + "</tbody>";
      var types = Object.keys(cur.shifts);
      var gaps = 0, doubles = 0;
      cov.forEach(function (r) {
        types.forEach(function (c) {
          var n = teamKeys.filter(function (t) { return r.codes[t] === c; }).length;
          if (n === 0) gaps++;
          if (n > 1) doubles++;
        });
      });
      var note = $("#sp-coverage-note");
      if (state.p === "custom" || types.length === 1 && cur.P.kind) {
        note.textContent = types.length === 1 && cur.P.kind
          ? "These teams share one shift type. Run a second set of teams on the other shift (days or nights) to cover 24 hours."
          : "Check the grid: each shift type should appear once per day for full coverage.";
      } else {
        note.textContent = gaps === 0 && doubles === 0 ? "Every shift is covered exactly once, every day." : "Heads up: " + gaps + " uncovered and " + doubles + " double-covered shift slots in this window.";
      }
    } else {
      covWrap.hidden = true;
    }
    T.saveLocal(KEY, state);
  }

  tool.addEventListener("change", function (e) {
    var t = e.target;
    if (t.matches("[data-shift]")) {
      var key = state.p + ":" + t.getAttribute("data-shift");
      state.shifts = state.shifts || {};
      state.shifts[key] = state.shifts[key] || {};
      state.shifts[key][t.getAttribute("data-k")] = t.value;
      update();
      return;
    }
    state.p = $("#sp-pattern").value;
    state.start = $("#sp-start").value || state.start;
    state.team = $("#sp-team").value;
    state.kind = $("#sp-kind").value;
    state.custom = $("#sp-custom").value;
    state.months = $("#sp-months").value;
    state.from = $("#sp-from").value;
    state.wstart = $("#sp-wstart").value;
    if (t.id === "sp-pattern" || t.id === "sp-kind" || t.id === "sp-custom") syncControls();
    update();
  });
  $("#sp-custom").addEventListener("input", function () {
    state.custom = $("#sp-custom").value;
    syncControls();
    update();
  });

  function rangeDays() {
    var parts = state.from.split("-");
    var from = state.from + "-01";
    var endMonth = +parts[1] - 1 + +state.months;
    var end = T.isoDate(Date.UTC(+parts[0] + Math.floor(endMonth / 12), endMonth % 12, 1));
    return { from: from, days: T.dayDiff(from, end) };
  }

  $("#sp-ics").addEventListener("click", function () {
    var cur = current(), r = rangeDays();
    var ics = T.icsFor({ seq: cur.seq, shifts: cur.shifts, cycleStart: state.start, offset: cur.teams[state.team] || 0, from: r.from, days: r.days,
      team: Object.keys(cur.teams).length > 1 ? state.team : "", calName: cur.P.name + (Object.keys(cur.teams).length > 1 ? " — Team " + state.team : "") });
    T.download("shifts-" + state.p + "-" + state.team + ".ics", "text/calendar;charset=utf-8", ics);
    T.track("tool_export", { tool: "shift-pattern", format: "ics" });
  });
  $("#sp-csv").addEventListener("click", function () {
    var cur = current(), r = rangeDays();
    var rows = [["Date", "Weekday", "Team", "Shift", "Start", "End", "Hours"]];
    for (var d = 0; d < r.days; d++) {
      var iso = T.addDays(r.from, d);
      var c = T.codeOn(cur.seq, state.start, cur.teams[state.team] || 0, iso);
      if (c === "O") { rows.push([iso, T.DOW[T.weekday(iso)], state.team, "Off", "", "", 0]); continue; }
      var s = cur.shifts[c], st = T.parseClock(s.start) || 0;
      rows.push([iso, T.DOW[T.weekday(iso)], state.team, s.label, s.start, T.fmtClock(st + Math.round(s.hours * 60), true), s.hours]);
    }
    T.download("shifts-" + state.p + "-" + state.team + ".csv", "text/csv;charset=utf-8", T.csv(rows));
    T.track("tool_export", { tool: "shift-pattern", format: "csv" });
  });
  $("#sp-print").addEventListener("click", function () { window.print(); });
  $("#sp-share").addEventListener("click", function () { T.copy(T.shareLink(state), "Share link copied"); });

  syncControls();
  update();
})(typeof window !== "undefined" ? window : globalThis);
