/* 824824 — shared helpers for every calculator (time math, money, export, share links).
   Pure functions are exported for tests via globalThis.T824. */
(function (root) {
  "use strict";
  var T = root.T824 = root.T824 || {};

  T.pad = function (n) { return String(n).padStart(2, "0"); };

  /* Parse a clock time into minutes after midnight (0-1439).
     Accepts "07:30", "7:30", "730", "0730", "7", "7:30 pm", "7pm", "19.5". Returns null if invalid. */
  T.parseClock = function (str) {
    if (str === null || str === undefined) return null;
    var s = String(str).trim().toLowerCase().replace(/\s+/g, "");
    if (!s) return null;
    var ap = null;
    var m = /(a|p)\.?m?\.?$/.exec(s);
    if (m) { ap = m[1]; s = s.slice(0, m.index); }
    var h, min;
    if (/^\d{1,2}:\d{2}$/.test(s)) { var p = s.split(":"); h = +p[0]; min = +p[1]; }
    else if (/^\d{3,4}$/.test(s)) { h = +s.slice(0, s.length - 2); min = +s.slice(-2); }
    else if (/^\d{1,2}$/.test(s)) { h = +s; min = 0; }
    else if (/^\d{1,2}\.\d+$/.test(s) && !ap) { var f = parseFloat(s); h = Math.floor(f); min = Math.round((f - h) * 60); }
    else return null;
    if (min > 59) return null;
    if (ap) {
      if (h < 1 || h > 12) return null;
      if (ap === "a" && h === 12) h = 0;
      if (ap === "p" && h !== 12) h += 12;
    }
    if (h === 24 && min === 0) return 1440;
    if (h > 23) return null;
    return h * 60 + min;
  };

  /* Parse a duration into minutes. Accepts "7:30", "7.5", "7h 30m", "450m", "7h", "-1:15". */
  T.parseDuration = function (str) {
    if (str === null || str === undefined) return null;
    var s = String(str).trim().toLowerCase().replace(/,/g, ".");
    if (!s) return null;
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1).trim();
    var v = null, m;
    if ((m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s))) {
      if (+m[2] > 59) return null;
      v = +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0);
    } else if ((m = /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:utes?|s)?)?)?$/.exec(s)) && (m[1] || m[2])) {
      v = (m[1] ? parseFloat(m[1]) * 60 : 0) + (m[2] ? parseFloat(m[2]) : 0);
    } else if (/^\d*\.?\d+$/.test(s)) {
      v = parseFloat(s) * 60;
    }
    if (v === null || isNaN(v)) return null;
    return neg ? -v : v;
  };

  /* Minutes of work between two clock times; crosses midnight when end <= start.
     Equal times mean a full 24-hour shift. */
  T.span = function (startMin, endMin) {
    if (startMin === null || endMin === null) return 0;
    if (endMin === startMin) return 1440;
    return endMin > startMin ? endMin - startMin : endMin + 1440 - startMin;
  };

  T.roundTo = function (min, inc) {
    if (!inc) return min;
    return Math.round(min / inc) * inc;
  };

  /* 450 -> "7:30"; durations can exceed 24 h. */
  T.fmtDur = function (min) {
    if (min === null || isNaN(min)) return "—";
    var neg = min < 0;
    var m = Math.round(Math.abs(min));
    return (neg ? "-" : "") + Math.floor(m / 60) + ":" + T.pad(m % 60);
  };

  T.fmtDec = function (min, places) {
    if (min === null || isNaN(min)) return "—";
    return (min / 60).toFixed(places === undefined ? 2 : places);
  };

  /* Clock label from minutes after midnight (wraps). */
  T.fmtClock = function (min, h24) {
    var m = ((Math.round(min) % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    if (h24) return T.pad(h) + ":" + T.pad(mm);
    var ap = h < 12 ? "AM" : "PM";
    var hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ":" + T.pad(mm) + " " + ap;
  };

  T.fmtMoney = function (n, cur) {
    if (n === null || isNaN(n)) return "—";
    var sym = cur || "$";
    var abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (n < 0 ? "-" : "") + sym + abs;
  };

  T.num = function (v, fallback) {
    var n = parseFloat(String(v === undefined || v === null ? "" : v).replace(/,/g, ""));
    return isNaN(n) ? (fallback === undefined ? 0 : fallback) : n;
  };

  /* Dates as "YYYY-MM-DD" strings, computed in UTC to avoid DST surprises. */
  T.parseDate = function (iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  };
  T.isoDate = function (ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" + T.pad(d.getUTCMonth() + 1) + "-" + T.pad(d.getUTCDate());
  };
  T.addDays = function (iso, n) { return T.isoDate(T.parseDate(iso) + n * 864e5); };
  T.dayDiff = function (a, b) { return Math.round((T.parseDate(b) - T.parseDate(a)) / 864e5); };
  T.weekday = function (iso) { return new Date(T.parseDate(iso)).getUTCDay(); };
  T.DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  T.DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  T.MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  T.fmtDate = function (iso, style) {
    var ms = T.parseDate(iso);
    if (ms === null) return "";
    var d = new Date(ms);
    var mon = T.MONTHS[d.getUTCMonth()];
    if (style === "short") return T.DOW[d.getUTCDay()] + " " + mon.slice(0, 3) + " " + d.getUTCDate();
    return mon + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  };
  T.today = function () {
    var d = new Date();
    return d.getFullYear() + "-" + T.pad(d.getMonth() + 1) + "-" + T.pad(d.getDate());
  };
  /* Most recent given weekday on or before a date. */
  T.weekStart = function (iso, dow) {
    var diff = (T.weekday(iso) - dow + 7) % 7;
    return T.addDays(iso, -diff);
  };

  T.csv = function (rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = c === null || c === undefined ? "" : String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\r\n") + "\r\n";
  };

  /* One entry: a duration ("7:30", "7.5", "7h 30m") or a time range ("19:00-07:00"). Minutes or null. */
  T.parseEntry = function (line) {
    var s = String(line || "").trim();
    if (!s) return null;
    var range = /^(.+?)\s*(?:-|\u2013|to)\s*(.+)$/i.exec(s);
    if (range && /[:apm]/i.test(s) && T.parseClock(range[1]) !== null && T.parseClock(range[2]) !== null) {
      return T.span(T.parseClock(range[1]) % 1440, T.parseClock(range[2]) % 1440);
    }
    return T.parseDuration(s);
  };

  /* Add up a list of durations or time ranges, one per line. */
  T.sumDurations = function (text) {
    var total = 0, bad = [], count = 0;
    String(text || "").split(/\n|;/).forEach(function (line, i) {
      if (!line.trim()) return;
      var v = T.parseEntry(line);
      if (v === null) bad.push(i + 1); else { total += v; count++; }
    });
    return { total: total, bad: bad, count: count };
  };

  /* Share-link state: base64url(JSON) in the URL hash. */
  T.encodeState = function (obj) {
    var json = JSON.stringify(obj);
    var b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf8").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  T.decodeState = function (str) {
    try {
      var b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var json = typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(json);
    } catch (e) { return null; }
  };

  /* ---------------------------------------------------------- browser-only helpers */
  if (typeof document === "undefined") return;

  T.$ = function (sel, r) { return (r || document).querySelector(sel); };
  T.$$ = function (sel, r) { return Array.prototype.slice.call((r || document).querySelectorAll(sel)); };

  T.download = function (filename, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  };

  T.toast = function (msg) { if (window.App) window.App.toast(msg); };
  T.copy = function (text, msg) { if (window.App) return window.App.copy(text, msg); };
  T.track = function (name, params) { if (window.App) window.App.track(name, params); };

  T.saveLocal = function (key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* ignore */ } };
  T.loadLocal = function (key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; } };

  T.stateFromHash = function () {
    var m = /[#&]s=([A-Za-z0-9_-]+)/.exec(location.hash);
    return m ? T.decodeState(m[1]) : null;
  };
  T.shareLink = function (obj) {
    return location.href.split("#")[0].split("?")[0] + "#s=" + T.encodeState(obj);
  };

  T.params = function () { return new URLSearchParams(location.search); };

  /* Bind every input/select inside root to a callback, debounced to animation frames. */
  T.onInput = function (rootEl, fn) {
    var raf = null;
    var run = function () { raf = null; fn(); };
    var schedule = function () { if (!raf) raf = requestAnimationFrame(run); };
    rootEl.addEventListener("input", schedule);
    rootEl.addEventListener("change", schedule);
  };

  /* Tabs: buttons [role=tab][aria-controls] inside .tabs. */
  T.tabs = function (rootEl, onChange) {
    var tabs = T.$$("[role=tab]", rootEl);
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (onChange) onChange(tab.getAttribute("data-tab"));
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        var n = tabs[(i + d + tabs.length) % tabs.length];
        n.focus();
        select(n);
      });
    });
    return select;
  };
})(typeof window !== "undefined" ? window : globalThis);
