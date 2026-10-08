/* 824824 — the 24-hour dial on the home page.
   Drag the ring (or use the arrow keys) to move your shift around the day. */
(function () {
  "use strict";
  var root = document.querySelector("[data-dial]");
  if (!root) return;

  var NS = "http://www.w3.org/2000/svg";
  var C = 200, R = 140, RS = 104;
  var svg = root.querySelector("svg.dial");
  var startInput = root.querySelector("[name=dial_start]");
  var lenInput = root.querySelector("[name=dial_len]");
  var out = {
    start: root.querySelector("[data-out=start]"),
    end: root.querySelector("[data-out=end]"),
    sleep: root.querySelector("[data-out=sleep]"),
    coffee: root.querySelector("[data-out=coffee]"),
    num: svg.querySelector(".center-num"),
    sub: svg.querySelector(".center-sub")
  };
  var links = {
    sleep: root.querySelector("[data-link=sleep]"),
    pay: root.querySelector("[data-link=pay]")
  };

  var state = { start: 23, len: 8 };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function pt(h, r) {
    var a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  }
  function arc(h0, span, r) {
    if (span >= 23.999) {
      var a = pt(h0, r), b = pt(h0 + 12, r);
      return "M" + a[0] + " " + a[1] + "A" + r + " " + r + " 0 1 1 " + b[0] + " " + b[1] + "A" + r + " " + r + " 0 1 1 " + a[0] + " " + a[1];
    }
    var p0 = pt(h0, r), p1 = pt(h0 + span, r);
    var large = span > 12 ? 1 : 0;
    return "M" + p0[0].toFixed(2) + " " + p0[1].toFixed(2) + "A" + r + " " + r + " 0 " + large + " 1 " + p1[0].toFixed(2) + " " + p1[1].toFixed(2);
  }
  function mod24(h) { return ((h % 24) + 24) % 24; }
  function hm(h) {
    h = mod24(h);
    var m = Math.round(h * 60) % 1440;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }
  function h12(h) {
    h = mod24(h);
    var m = Math.round(h * 60) % 1440;
    var hh = Math.floor(m / 60), mm = m % 60;
    var ap = hh < 12 ? "AM" : "PM";
    var d = hh % 12 === 0 ? 12 : hh % 12;
    return d + ":" + String(mm).padStart(2, "0") + " " + ap;
  }

  // static drawing ------------------------------------------------------
  svg.innerHTML = "";
  var ring = el("g", { class: "ring" }, svg);
  ring.style.touchAction = "none";
  el("circle", { class: "track", cx: C, cy: C, r: R, "stroke-width": 30 }, ring);
  el("path", { class: "night-band", d: arc(22, 8, R), "stroke-width": 30 }, ring);
  for (var h = 0; h < 24; h++) {
    var major = h % 6 === 0;
    var a = pt(h, 160), b = pt(h, major ? 172 : 166);
    el("line", { class: major ? "tick tick-major" : "tick", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, svg);
    if (h % 3 === 0) {
      var lp = pt(h, 186);
      var t = el("text", { class: "hour-label", x: lp[0], y: lp[1], "text-anchor": "middle", "dominant-baseline": "central" }, svg);
      t.textContent = String(h).padStart(2, "0");
    }
  }
  var sleepArc = el("path", { class: "sleep-arc", "stroke-width": 12 }, svg);
  var shiftArc = el("path", { class: "shift-arc", "stroke-width": 30 }, ring);
  var handle = el("circle", { class: "handle", r: 13 }, ring);
  var nowHand = el("line", { class: "now-hand" }, svg);
  var nowDot = el("circle", { class: "now-dot", r: 5 }, svg);
  out.num = el("text", { class: "center-num", x: C, y: C + 16, "text-anchor": "middle" }, svg);
  out.sub = el("text", { class: "center-sub", x: C, y: C + 48, "text-anchor": "middle" }, svg);
  out.sub2 = el("text", { class: "center-sub", x: C, y: C + 68, "text-anchor": "middle" }, svg);

  // sleep suggestion (a starting point; the sleep planner does the full job)
  function sleepWindow(start, len) {
    var end = mod24(start + len);
    var s, d;
    if (len >= 20) return null;
    if (end >= 3 && end < 12) { s = end + 1; d = 7; }
    else if (end >= 12 && end < 20) { d = 7.5; s = start - 1.25 - d; }
    else { s = end + 1; d = 7.5; }
    return { start: mod24(s), len: d };
  }

  function render(drawLen) {
    var len = drawLen === undefined ? state.len : drawLen;
    shiftArc.setAttribute("d", arc(state.start, Math.max(len, 0.01), R));
    var hp = pt(state.start, R);
    handle.setAttribute("cx", hp[0]);
    handle.setAttribute("cy", hp[1]);
    var sw = sleepWindow(state.start, state.len);
    if (sw) {
      sleepArc.setAttribute("d", arc(sw.start, sw.len, RS));
      sleepArc.style.display = "";
    } else {
      sleepArc.style.display = "none";
    }
    out.num.textContent = String(+state.len.toFixed(2)).replace(".5", "½");
    out.sub.textContent = "of 24 hours";
    out.sub2.textContent = "on shift";
    var end = state.start + state.len;
    out.start.innerHTML = hm(state.start) + "<small>" + h12(state.start) + "</small>";
    out.end.innerHTML = hm(end) + (end >= 24 ? " <small>next day</small>" : "<small>" + h12(end) + "</small>");
    if (sw) {
      out.sleep.innerHTML = hm(sw.start) + "<small>to " + hm(sw.start + sw.len) + "</small>";
      out.coffee.innerHTML = hm(sw.start - 6) + "<small>" + h12(sw.start - 6) + "</small>";
    } else {
      out.sleep.innerHTML = "On duty<small>sleep in shifts</small>";
      out.coffee.innerHTML = "—";
    }
    if (startInput && document.activeElement !== startInput) startInput.value = hm(state.start);
    svg.setAttribute("aria-valuenow", String(state.start));
    svg.setAttribute("aria-valuetext", "Shift starts " + hm(state.start) + ", ends " + hm(end) + ", " + state.len + " hours");
    var q = "start=" + encodeURIComponent(hm(state.start)) + "&end=" + encodeURIComponent(hm(end));
    if (links.sleep) links.sleep.href = "night-shift-sleep-planner.html?" + q;
    if (links.pay) links.pay.href = "shift-differential-calculator.html?" + q;
  }

  function tickNow() {
    var d = new Date();
    var h = d.getHours() + d.getMinutes() / 60;
    var p = pt(h, 122), q = pt(h, 94);
    nowHand.setAttribute("x1", q[0]);
    nowHand.setAttribute("y1", q[1]);
    nowHand.setAttribute("x2", p[0]);
    nowHand.setAttribute("y2", p[1]);
    nowDot.setAttribute("cx", p[0]);
    nowDot.setAttribute("cy", p[1]);
  }

  // interaction ------------------------------------------------------------
  function hourFromEvent(e) {
    var r = svg.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width * 400 - C;
    var y = (e.clientY - r.top) / r.height * 400 - C;
    var ang = Math.atan2(y, x) + Math.PI / 2;
    return mod24(ang / (2 * Math.PI) * 24);
  }
  function snap(h) { return mod24(Math.round(h * 4) / 4); }

  var dragging = false, offset = 0;
  ring.addEventListener("pointerdown", function (e) {
    var ph = hourFromEvent(e);
    var into = mod24(ph - state.start);
    offset = into <= state.len ? into : 0;
    if (!offset) { state.start = snap(ph); render(); }
    dragging = true;
    svg.classList.add("dragging");
    ring.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  ring.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    state.start = snap(hourFromEvent(e) - offset);
    render();
  });
  function stop() {
    if (!dragging) return;
    dragging = false;
    svg.classList.remove("dragging");
    if (window.App) window.App.track("dial_use", { start: hm(state.start), len: state.len });
  }
  ring.addEventListener("pointerup", stop);
  ring.addEventListener("pointercancel", stop);

  svg.addEventListener("keydown", function (e) {
    var step = { ArrowRight: 0.25, ArrowUp: 0.25, ArrowLeft: -0.25, ArrowDown: -0.25, PageUp: 1, PageDown: -1 }[e.key];
    if (step) { e.preventDefault(); state.start = snap(state.start + step); render(); }
  });
  if (startInput) startInput.addEventListener("input", function () {
    var m = /^(\d{1,2}):(\d{2})/.exec(startInput.value);
    if (m) { state.start = snap(+m[1] + +m[2] / 60); render(); }
  });
  if (lenInput) lenInput.addEventListener("change", function () {
    state.len = parseFloat(lenInput.value) || 8;
    render();
  });

  // first paint: one orchestrated sweep of the 8-hour arc ---------------------
  tickNow();
  setInterval(tickNow, 30000);
  if (reduce) { render(); return; }
  var t0 = null;
  render(0.01);
  function sweep(ts) {
    if (t0 === null) t0 = ts;
    var p = Math.min(1, (ts - t0) / 900);
    var eased = 1 - Math.pow(1 - p, 3);
    render(state.len * eased);
    if (p < 1) requestAnimationFrame(sweep); else render();
  }
  setTimeout(function () { requestAnimationFrame(sweep); }, 250);
})();
