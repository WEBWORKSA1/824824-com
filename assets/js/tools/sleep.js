/* 824824 — Night shift sleep planner. General wellness information, not medical advice. */
(function (root) {
  "use strict";
  var T = root.T824;

  /* Times are minutes after the shift starts; the plan covers 24 hours (shift to next shift).
     i: { start, end, commute, wind, need (hours), strategy ('after'|'split'|'before'), caffeineHours } */
  T.sleepPlan = function (i) {
    var s = T.parseClock(i.start), e = T.parseClock(i.end);
    if (s === null || e === null) return null;
    var shiftLen = T.span(s % 1440, e % 1440);
    var commute = Math.max(0, T.num(i.commute, 30));
    var wind = Math.max(0, T.num(i.wind, 30));
    var need = Math.max(60, T.num(i.need, 7.5) * 60);
    var prep = 60;
    var home = shiftLen + commute;
    var bed = home + wind;
    var latestWake = 1440 - commute - prep;
    var available = latestWake - bed;
    var segs = [{ type: "shift", from: 0, to: shiftLen, label: "Shift" }];
    if (commute) segs.push({ type: "commute", from: shiftLen, to: home, label: "Commute" });
    if (wind) segs.push({ type: "wind", from: home, to: bed, label: "Wind down" });
    var sleeps = [];
    if (available <= 0) {
      return { shiftLen: shiftLen, available: available, segs: segs, sleeps: [], short: true, s: s };
    }
    var strategy = i.strategy || "after";
    if (strategy === "split") {
      var anchor = Math.min(need, 270, available);
      var nap = Math.max(0, Math.min(need - anchor, available - anchor - 60));
      if (nap < 30) nap = 0;
      sleeps.push({ type: "sleep", from: bed, to: bed + anchor, label: "Anchor sleep" });
      if (nap) sleeps.push({ type: "nap", from: latestWake - nap, to: latestWake, label: "Nap" });
    } else if (strategy === "before") {
      var len = Math.min(need, available);
      sleeps.push({ type: "sleep", from: latestWake - len, to: latestWake, label: "Main sleep" });
    } else {
      var len2 = Math.min(need, available);
      sleeps.push({ type: "sleep", from: bed, to: bed + len2, label: "Main sleep" });
    }
    var cursor = bed;
    sleeps.forEach(function (sl) {
      if (sl.from > cursor + 1) segs.push({ type: "free", from: cursor, to: sl.from, label: "Your time" });
      segs.push(sl);
      cursor = sl.to;
    });
    if (latestWake > cursor + 1) segs.push({ type: "free", from: cursor, to: latestWake, label: "Your time" });
    segs.push({ type: "wind", from: latestWake, to: latestWake + prep, label: "Get ready" });
    if (commute) segs.push({ type: "commute", from: latestWake + prep, to: 1440, label: "Commute" });
    var slept = sleeps.reduce(function (a, x) { return a + (x.to - x.from); }, 0);
    var main = sleeps[0];
    var caffeine = main ? main.from - Math.max(1, T.num(i.caffeineHours, 6)) * 60 : null;
    return {
      s: s, shiftLen: shiftLen, segs: segs, sleeps: sleeps, slept: slept, need: need, available: available,
      short: slept < need - 1, caffeineCutoff: caffeine, lightUntil: shiftLen / 2, mainStart: main ? main.from : null
    };
  };

  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=sleep]");
  if (!tool) return;
  var $ = function (s) { return T.$(s, tool); };

  function read() {
    var strat = T.$("input[name=sl-strategy]:checked", tool);
    return { start: $("#sl-start").value, end: $("#sl-end").value, commute: $("#sl-commute").value, wind: $("#sl-wind").value,
      need: $("#sl-need").value, strategy: strat ? strat.value : "after", caffeineHours: $("#sl-caf").value, h24: $("#sl-h24").checked };
  }

  function clock(r, t, h24) { return T.fmtClock(r.s + t, h24); }

  function update() {
    var i = read();
    var r = T.sleepPlan(i);
    var bar = $("#sl-bar"), list = $("#sl-list"), warn = $("#sl-warn");
    if (!r) { bar.innerHTML = ""; list.innerHTML = ""; return; }
    var h24 = i.h24;
    bar.innerHTML = r.segs.map(function (g) {
      var w = (g.to - g.from) / 1440 * 100;
      var cls = { shift: "tl-shift", sleep: "tl-sleep", nap: "tl-nap", commute: "tl-commute", wind: "tl-wind", free: "tl-free" }[g.type];
      var label = w > 9 ? g.label : "";
      return '<div class="tl-seg ' + cls + '" style="width:' + w.toFixed(3) + '%" title="' + g.label + ": " + clock(r, g.from, h24) + "–" + clock(r, g.to, h24) + '">' + label + "</div>";
    }).join("");
    $("#sl-scale").innerHTML = [0, 6, 12, 18, 24].map(function (h) { return "<span>" + clock(r, h * 60, h24) + "</span>"; }).join("");

    var items = [];
    items.push(["eve", 0, "Shift starts. Get bright light in the first half of your shift, until about " + clock(r, r.lightUntil, h24) + "."]);
    items.push(["eve", r.lightUntil, "Second half: dim the lights where it's safe to, so sleep comes easier later."]);
    if (r.caffeineCutoff !== null && r.caffeineCutoff > 0) items.push(["eve", r.caffeineCutoff, "Last caffeine, about " + T.num(i.caffeineHours, 6) + " hours before you plan to sleep."]);
    items.push(["day", r.shiftLen, "Shift ends. Head home; avoid bright morning light. Sunglasses help, but wear them only if someone else is driving."]);
    r.sleeps.forEach(function (sl) {
      items.push(["night", sl.from, sl.label + " until " + clock(r, sl.to, h24) + " (" + T.fmtDur(sl.to - sl.from) + "). Dark, cool and quiet room; phone on do-not-disturb."]);
    });
    items.push(["rest", 1440 - (T.num(i.commute, 30)) - 60, "Up and get ready. Eat your main meal before the shift, around your usual dinnertime."]);
    items.sort(function (a, b) { return a[1] - b[1]; });
    list.innerHTML = items.map(function (it) {
      return '<li class="code-' + it[0] + '"><time>' + clock(r, it[1], h24) + "</time><span>" + it[2] + "</span></li>";
    }).join("");

    $("#sl-total").textContent = T.fmtDur(r.slept || 0);
    $("#sl-total-sub").textContent = "of sleep planned between shifts (you asked for " + T.fmtDur(r.need) + ")";
    warn.innerHTML = "";
    if (r.available <= 0) {
      warn.innerHTML = "<li>There isn't enough time between these shifts to sleep at home. Talk to your scheduler about rest between shifts.</li>";
    } else if (r.short) {
      warn.innerHTML = "<li>Only " + T.fmtDur(r.slept) + " of sleep fits between these shifts once travel and getting ready are counted. Shorten the commute or wind-down, or protect your days off for recovery sleep.</li>";
    }
    T.saveLocal("sl-state-v1", i);
  }

  var p = T.params();
  var saved = T.stateFromHash() || T.loadLocal("sl-state-v1");
  if (saved && !p.get("start")) {
    ["start", "end", "commute", "wind", "need"].forEach(function (k) { if (saved[k] !== undefined) $("#sl-" + k).value = saved[k]; });
    if (saved.caffeineHours) $("#sl-caf").value = saved.caffeineHours;
    $("#sl-h24").checked = saved.h24 !== false;
    var rb = T.$("input[name=sl-strategy][value=" + (saved.strategy || "after") + "]", tool);
    if (rb) rb.checked = true;
  }
  if (p.get("start")) $("#sl-start").value = p.get("start");
  if (p.get("end")) $("#sl-end").value = p.get("end");
  T.onInput(tool, update);
  $("#sl-print").addEventListener("click", function () { window.print(); });
  $("#sl-share").addEventListener("click", function () { T.copy(T.shareLink(read()), "Share link copied"); });
  update();
})(typeof window !== "undefined" ? window : globalThis);
