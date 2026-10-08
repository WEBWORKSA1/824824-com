/* Unit tests for 824824 calculator math. Run: node tests/tools.test.js */
"use strict";
var assert = require("assert");
var path = require("path");
var files = ["core", "time-card", "hours", "overtime", "differential", "salary", "pattern", "staffing", "sleep", "military", "decimal"];
files.forEach(function (f) { require(path.join(__dirname, "..", "assets", "js", "tools", f + ".js")); });
var T = globalThis.T824;
var passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error("FAIL " + name + "\n  " + e.message); process.exitCode = 1; }
}
var near = function (a, b, eps) { assert.ok(Math.abs(a - b) < (eps || 1e-6), a + " != " + b); };

// ---------------------------------------------------------------- core
test("parseClock formats", function () {
  assert.strictEqual(T.parseClock("07:30"), 450);
  assert.strictEqual(T.parseClock("7:30"), 450);
  assert.strictEqual(T.parseClock("0730"), 450);
  assert.strictEqual(T.parseClock("730"), 450);
  assert.strictEqual(T.parseClock("7"), 420);
  assert.strictEqual(T.parseClock("7:30 pm"), 1170);
  assert.strictEqual(T.parseClock("12am"), 0);
  assert.strictEqual(T.parseClock("12:15 PM"), 735);
  assert.strictEqual(T.parseClock("2400"), 1440);
  assert.strictEqual(T.parseClock("25:00"), null);
  assert.strictEqual(T.parseClock("7:75"), null);
  assert.strictEqual(T.parseClock(""), null);
  assert.strictEqual(T.parseClock("13pm"), null);
});
test("parseDuration formats", function () {
  assert.strictEqual(T.parseDuration("7:30"), 450);
  assert.strictEqual(T.parseDuration("7.5"), 450);
  assert.strictEqual(T.parseDuration("7h 30m"), 450);
  assert.strictEqual(T.parseDuration("45m"), 45);
  assert.strictEqual(T.parseDuration("-1:15"), -75);
  assert.strictEqual(T.parseDuration("abc"), null);
});
test("span, rounding and formatting", function () {
  assert.strictEqual(T.span(1140, 450), 750);
  assert.strictEqual(T.span(420, 420), 1440);
  assert.strictEqual(T.roundTo(458, 15), 465);
  assert.strictEqual(T.roundTo(457, 15), 450);
  assert.strictEqual(T.fmtDur(2550), "42:30");
  assert.strictEqual(T.fmtDec(450), "7.50");
  assert.strictEqual(T.fmtClock(1170, false), "7:30 PM");
  assert.strictEqual(T.fmtClock(0, false), "12:00 AM");
  assert.strictEqual(T.fmtClock(1500, true), "01:00");
  assert.strictEqual(T.fmtMoney(1234.5, "$"), "$1,234.50");
});
test("dates", function () {
  assert.strictEqual(T.addDays("2026-10-31", 1), "2026-11-01");
  assert.strictEqual(T.weekday("2026-10-08"), 4);
  assert.strictEqual(T.weekStart("2026-10-08", 0), "2026-10-04");
  assert.strictEqual(T.weekStart("2026-10-08", 1), "2026-10-05");
  assert.strictEqual(T.dayDiff("2026-03-01", "2026-03-31"), 30);
});
test("share state round trip", function () {
  var s = { a: "Ünïcode ✓", n: [1, 2] };
  assert.deepStrictEqual(T.decodeState(T.encodeState(s)), s);
});
test("csv escaping", function () {
  assert.strictEqual(T.csv([["a", "b,c", 'd"e']]), 'a,"b,c","d""e"\r\n');
});
test("sum durations including ranges", function () {
  var r = T.sumDurations("7:30\n8h\n19:00-07:00\nnope\n0.5");
  assert.strictEqual(r.total, 450 + 480 + 720 + 30);
  assert.deepStrictEqual(r.bad, [4]);
});

// ---------------------------------------------------------------- time card
function card(rows, extra) {
  var s = { start: "2026-10-04", days: 7, rows: rows, round: 0, attr: "start", rule: "us", rate: "20", otm: 1.5, dtm: 2, rest: 660, custom: {} };
  Object.keys(extra || {}).forEach(function (k) { s[k] = extra[k]; });
  return T.timecard(s);
}
function week(list) { return list.map(function (x) { return { d: x[0], in: x[1], out: x[2], brk: x[3] || 0 }; }); }

test("time card: 5 x 9h with 30 min break, US federal", function () {
  var r = card(week([[1, "08:00", "17:00", 30], [2, "08:00", "17:00", 30], [3, "08:00", "17:00", 30], [4, "08:00", "17:00", 30], [5, "08:00", "17:00", 30]]));
  assert.strictEqual(r.totals.worked, 5 * 510);
  assert.strictEqual(r.totals.ot, 150);
  assert.strictEqual(r.totals.reg, 2400);
  near(r.totals.pay, 40 * 20 + 2.5 * 30);
});
test("time card: overnight shifts credited to start day", function () {
  var r = card(week([[1, "19:00", "07:30", 30], [2, "19:00", "07:30", 30], [4, "19:00", "07:30", 30], [5, "19:00", "07:30", 30]]));
  assert.strictEqual(r.rows[0].worked, 720);
  assert.strictEqual(r.totals.worked, 2880);
  assert.strictEqual(r.totals.ot, 480);
});
test("time card: split at midnight", function () {
  var r = card(week([[1, "22:00", "06:00", 0]]), { attr: "split" });
  assert.strictEqual(r.days[1], 120);
  assert.strictEqual(r.days[2], 360);
});
test("time card: California daily OT and double time", function () {
  var r = card(week([[1, "06:00", "20:00", 0]]), { rule: "ca" });
  assert.strictEqual(r.totals.reg, 480);
  assert.strictEqual(r.totals.ot, 240);
  assert.strictEqual(r.totals.dt, 120);
});
test("time card: California seventh consecutive day", function () {
  var rows = [];
  for (var d = 0; d < 7; d++) rows.push([d, "08:00", d === 6 ? "18:00" : "13:00", 0]);
  var r = card(week(rows), { rule: "ca" });
  // six 5-hour days = 30 regular; day 7: 10 hours -> 8 OT + 2 DT
  assert.strictEqual(r.totals.reg, 1800);
  assert.strictEqual(r.totals.ot, 480);
  assert.strictEqual(r.totals.dt, 120);
});
test("time card: daily OT hours not double counted toward weekly 40 (CA/BC)", function () {
  var rows = [];
  for (var d = 1; d <= 5; d++) rows.push([d, "07:00", "17:00", 0]); // 10h x 5
  var r = card(week(rows), { rule: "bc" });
  assert.strictEqual(r.totals.reg, 2400);
  assert.strictEqual(r.totals.ot, 600);
});
test("time card: Alberta takes the greater of daily or weekly", function () {
  var rows = [];
  for (var d = 1; d <= 4; d++) rows.push([d, "07:00", "19:00", 0]); // 4 x 12h = 48h
  var r = card(week(rows), { rule: "ab" });
  // daily OT = 4 x 4 = 16h; weekly = 48 - 44 = 4h -> 16h
  assert.strictEqual(r.totals.ot, 960);
  var rows2 = [];
  for (d = 0; d < 6; d++) rows2.push([d, "08:00", "16:00", 0]); // 6 x 8 = 48h
  var r2 = card(week(rows2), { rule: "ab" });
  assert.strictEqual(r2.totals.ot, 240);
});
test("time card: Ontario 44 hours", function () {
  var rows = [];
  for (var d = 0; d < 4; d++) rows.push([d, "07:00", "19:00", 0]);
  var r = card(week(rows), { rule: "on" });
  assert.strictEqual(r.totals.ot, 240);
});
test("time card: two weeks are computed separately", function () {
  var rows = [];
  for (var d = 0; d < 14; d++) rows.push([d, "07:00", d < 7 && d < 4 ? "19:00" : "07:00", 0]);
  var s = { start: "2026-10-04", days: 14, rows: rows.map(function (x) { return { d: x[0], in: x[1], out: x[1] === x[2] ? "" : x[2], brk: 0 }; }), rule: "us", rate: 0, round: 0, attr: "start", custom: {} };
  var r = T.timecard(s);
  assert.strictEqual(r.weeks.length, 2);
  assert.strictEqual(r.weeks[0].ot, 480);
  assert.strictEqual(r.weeks[1].total, 0);
});
test("time card: rounding to quarter hour", function () {
  var r = card(week([[1, "07:53", "16:08", 0]]), { round: 15 });
  assert.strictEqual(r.rows[0].worked, 8 * 60 + 15);
});
test("time card: rest warning under 11 hours", function () {
  var r = card(week([[1, "15:00", "23:30", 0], [2, "07:00", "15:00", 0]]));
  assert.ok(r.warnings.some(function (w) { return /off between/.test(w.text); }));
});
test("time card: custom thresholds", function () {
  var r = card(week([[1, "08:00", "20:00", 0]]), { rule: "custom", custom: { daily: "10", dailyDT: "", weekly: "" } });
  assert.strictEqual(r.totals.ot, 120);
});

// ---------------------------------------------------------------- overtime
test("overtime: regular-rate method with differential and bonus", function () {
  var r = T.overtimePay({ rate: 20, hours: 50, threshold: 40, mult: 1.5, diffHours: 20, diffType: "flat", diffValue: 2, bonus: 50, method: "regular" });
  near(r.regularRate, 21.8);
  near(r.total, 1199);
  near(r.totalSimple, 1190);
  near(r.gap, 9);
  near(r.basePay + r.otPay + r.dtPay + r.diffPay + r.bonus, r.total);
});
test("overtime: simple 45 hours", function () {
  var r = T.overtimePay({ rate: 18, hours: 45, threshold: 40, mult: 1.5, method: "simple" });
  near(r.total, 40 * 18 + 5 * 27);
  near(r.basePay + r.otPay + r.dtPay + r.diffPay + r.bonus, r.total);
});

// ---------------------------------------------------------------- differential
test("differential: window overlap across midnight", function () {
  assert.strictEqual(T.windowOverlap(23 * 60, 480, 23 * 60, 7 * 60), 480);
  assert.strictEqual(T.windowOverlap(15 * 60, 720, 23 * 60, 7 * 60), 240);
  assert.strictEqual(T.windowOverlap(7 * 60, 720, 23 * 60, 7 * 60), 0);
});
test("differential: night premium per shift", function () {
  var r = T.differential({ rate: 30, start: "19:00", end: "07:00", brk: 0, mode: "inside",
    windows: [{ label: "Night", enabled: true, start: "23:00", end: "07:00", type: "pct", value: 10 }], shiftsPerWeek: 3, weeksPerYear: 52 });
  near(r.base, 360);
  near(r.premium, 8 * 3);
  near(r.premiumPerYear, 24 * 3 * 52);
});
test("differential: majority rule", function () {
  var r = T.differential({ rate: 20, start: "19:00", end: "07:00", brk: 0, mode: "majority",
    windows: [{ label: "Night", enabled: true, start: "23:00", end: "07:00", type: "flat", value: 2 }] });
  near(r.premium, 24);
});

// ---------------------------------------------------------------- salary
test("salary: hourly to annual and back", function () {
  var r = T.convertPay({ amount: 25, period: "hourly", hoursPerWeek: 40, weeksPerYear: 52 });
  near(r.base.annual, 52000);
  near(r.base.monthly, 52000 / 12);
  var b = T.convertPay({ amount: 52000, period: "annual", hoursPerWeek: 40, weeksPerYear: 52 });
  near(b.base.hourly, 25);
  var rot = T.convertPay({ amount: 30, period: "hourly", hoursPerWeek: 42, weeksPerYear: 52 });
  near(rot.base.annual, 30 * 42 * 52);
});

// ---------------------------------------------------------------- patterns
test("patterns: average weekly hours", function () {
  var expect = { pitman: 42, panama: 42, dupont: 42, fouron: 42, fouronrot: 42, continental: 42, f2448: 56, f4896: 56, fourtens: 40, fivetwo: 40, nineeighty: 40 };
  Object.keys(expect).forEach(function (k) {
    var P = T.PATTERNS[k];
    var st = T.patternStats(P.seq, P.shifts);
    near(st.avg, expect[k], 1e-9);
  });
});
test("patterns: four-team rotations cover every shift exactly once a day", function () {
  ["panama", "dupont", "fouronrot", "continental", "f2448", "f4896"].forEach(function (k) {
    var P = T.PATTERNS[k];
    var cov = T.coverage(P.seq, P.teams, "2026-10-05", "2026-10-05", P.seq.length * 2);
    var types = Object.keys(P.shifts);
    cov.forEach(function (row) {
      types.forEach(function (c) {
        var n = Object.keys(P.teams).filter(function (t) { return row.codes[t] === c; }).length;
        assert.strictEqual(n, 1, k + " " + row.date + " shift " + c + " covered " + n + " times");
      });
    });
  });
});
test("patterns: fixed-shift pairs complement each other", function () {
  ["pitman", "fouron"].forEach(function (k) {
    var P = T.PATTERNS[k];
    var cov = T.coverage(P.seq, P.teams, "2026-10-05", "2026-10-05", 28);
    cov.forEach(function (row) {
      var on = Object.keys(P.teams).filter(function (t) { return row.codes[t] !== "O"; }).length;
      assert.strictEqual(on, 1, k + " " + row.date);
    });
  });
});
test("patterns: Pitman overtime depends on payroll week start", function () {
  var P = T.PATTERNS.pitman;
  var ot = T.overtimeByWeekStart(P.seq, P.shifts, "2026-10-05", 0, 40); // cycle starts Monday
  near(ot[1].avgOt, 10); // Monday-start: 60/24 weeks -> 20 h per 2 weeks
  near(ot[0].avgOt, 4);  // Sunday-start: 36/48 weeks -> 8 h per 2 weeks
  assert.strictEqual(ot[0].minWeek, 36);
  assert.strictEqual(ot[0].maxWeek, 48);
});
test("patterns: DuPont longest stretches", function () {
  var P = T.PATTERNS.dupont;
  var st = T.patternStats(P.seq, P.shifts);
  assert.strictEqual(st.longestOn, 4);
  assert.strictEqual(st.longestOff, 7);
  assert.strictEqual(st.nights, 7);
});
test("patterns: custom sequence normalization", function () {
  assert.strictEqual(T.normalizeSeq("dd nn--00 11"), "DDNNOOOODD");
});
test("patterns: ics has overnight end on next day", function () {
  var ics = T.icsFor({ seq: "NO", shifts: { N: { label: "Night", start: "19:00", hours: 12 } }, cycleStart: "2026-10-05", offset: 0, from: "2026-10-05", days: 2, team: "A", calName: "x" });
  assert.ok(/DTSTART:20261005T190000/.test(ics));
  assert.ok(/DTEND:20261006T070000/.test(ics));
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(/\r\n/.test(ics));
});

// ---------------------------------------------------------------- staffing
test("staffing: one 24/7 post on 42-hour rotations needs 4 people", function () {
  var r = T.staffing({ positions: 1, hoursPerDay: 24, daysPerWeek: 7, shiftLength: 12, avgHours: 42, absence: 0 });
  near(r.coverage, 168);
  near(r.fte, 4);
  assert.strictEqual(r.headcount, 4);
});
test("staffing: absence raises headcount and gap math", function () {
  var r = T.staffing({ positions: 2, hoursPerDay: 24, daysPerWeek: 7, avgHours: 40, absence: 10, rate: 25, otMult: 1.5, headcount: 8 });
  near(r.fte, 336 / 36);
  assert.strictEqual(r.headcount, 10);
  near(r.gapHours, 336 - 8 * 36);
  near(r.otCostWeekly, 48 * 25 * 1.5);
  assert.strictEqual(T.teamBand(10), "1-10");
  assert.strictEqual(T.teamBand(11), "11-50");
});

// ---------------------------------------------------------------- sleep
test("sleep: morning sleeper after a 7p-7a shift", function () {
  var r = T.sleepPlan({ start: "19:00", end: "07:00", commute: 30, wind: 30, need: 7, strategy: "after", caffeineHours: 6 });
  assert.strictEqual(r.sleeps[0].from, 720 + 60);
  assert.strictEqual(r.sleeps[0].to, 720 + 60 + 420);
  assert.strictEqual(r.caffeineCutoff, 780 - 360);
  var total = r.segs.reduce(function (a, g) { return a + (g.to - g.from); }, 0);
  assert.strictEqual(total, 1440);
});
test("sleep: split strategy keeps anchor plus nap", function () {
  var r = T.sleepPlan({ start: "23:00", end: "07:00", commute: 30, wind: 30, need: 7.5, strategy: "split" });
  assert.strictEqual(r.sleeps.length, 2);
  assert.strictEqual(r.slept, 450);
  assert.strictEqual(r.sleeps[1].to, 1440 - 30 - 60);
});
test("sleep: not enough time warns", function () {
  var r = T.sleepPlan({ start: "07:00", end: "23:00", commute: 60, wind: 60, need: 8, strategy: "after" });
  assert.ok(r.short);
});

// ---------------------------------------------------------------- military + decimal
test("military: conversions and speech", function () {
  assert.strictEqual(T.toMilitary(1170), "1930");
  assert.strictEqual(T.sayMilitary(420), "zero seven hundred hours");
  assert.strictEqual(T.sayMilitary(1170), "nineteen thirty");
  assert.strictEqual(T.sayMilitary(0), "zero hundred hours");
  assert.strictEqual(T.sayMilitary(5), "zero zero zero five");
  assert.strictEqual(T.sayMilitary(745), "twelve twenty-five");
  assert.strictEqual(T.sayMilitary(725), "twelve zero five");
  assert.strictEqual(T.sayMilitary(1205 - 60 * 0), "twenty zero five");
});
test("decimal hours", function () {
  near(T.toDecimalHours(7, 45), 7.75);
  assert.deepStrictEqual(T.fromDecimalHours(7.75), { h: 7, m: 45, sign: 1 });
  assert.deepStrictEqual(T.fromDecimalHours(8.33), { h: 8, m: 20, sign: 1 });
});

console.log(passed + " tests passed" + (process.exitCode ? " (with failures)" : ""));
