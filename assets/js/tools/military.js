/* 824824 — Military (24-hour) time converter. */
(function (root) {
  "use strict";
  var T = root.T824;
  var ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
    "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  var TENS = ["", "", "twenty", "thirty", "forty", "fifty"];

  function words(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""); }

  T.toMilitary = function (min) {
    var m = ((min % 1440) + 1440) % 1440;
    return T.pad(Math.floor(m / 60)) + T.pad(m % 60);
  };

  /* How 24-hour time is commonly spoken: 0700 "zero seven hundred hours", 1930 "nineteen thirty". */
  T.sayMilitary = function (min) {
    var m = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    var hp = h === 0 ? "zero zero" : h < 10 ? "zero " + ONES[h] : words(h);
    if (mm === 0) return (h === 0 ? "zero" : hp) + " hundred hours";
    return hp + " " + (mm < 10 ? "zero " + ONES[mm] : words(mm));
  };

  if (typeof document === "undefined") return;
  var tool = T.$("[data-tool=military]");
  if (!tool) return;
  var $ = function (s) { return T.$(s, tool); };

  function from12() {
    var min = T.parseClock($("#mt-12").value + " " + $("#mt-ap").value);
    if (min === null || min === 1440) { $("#mt-12-out").textContent = "----"; $("#mt-12-say").textContent = "Enter a time like 7:30"; return; }
    $("#mt-12-out").textContent = T.toMilitary(min);
    $("#mt-12-say").textContent = "Say: “" + T.sayMilitary(min) + "”. Written " + T.fmtClock(min, true) + ".";
  }
  function from24() {
    var raw = $("#mt-24").value.trim();
    var min = /^\d{3,4}$/.test(raw) || /^\d{1,2}:\d{2}$/.test(raw) ? T.parseClock(raw) : null;
    if (min === 1440) { $("#mt-24-out").textContent = "12:00 AM"; $("#mt-24-say").textContent = "2400 marks the end of a day: midnight, same as 0000 of the next day."; return; }
    if (min === null) { $("#mt-24-out").textContent = "--:--"; $("#mt-24-say").textContent = "Enter four digits, like 1930"; return; }
    $("#mt-24-out").textContent = T.fmtClock(min, false);
    $("#mt-24-say").textContent = "Say: “" + T.sayMilitary(min) + "”.";
  }
  function bulk() {
    var lines = $("#mt-bulk").value.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    $("#mt-bulk-out").value = lines.map(function (l) {
      var min = T.parseClock(l);
      if (min === null) return l + "  ->  ?";
      return /[ap]/i.test(l) ? l + "  ->  " + T.toMilitary(min) : l + "  ->  " + T.fmtClock(min, false);
    }).join("\n");
  }
  function now() {
    var d = new Date();
    var min = d.getHours() * 60 + d.getMinutes();
    $("#mt-now").textContent = T.toMilitary(min);
    $("#mt-now-sub").textContent = T.fmtClock(min, false) + " where you are. Say “" + T.sayMilitary(min) + "”.";
  }
  function table() {
    var rows = "";
    for (var h = 0; h < 24; h++) {
      rows += "<tr><td>" + T.fmtClock(h * 60, false) + "</td><td><strong>" + T.pad(h) + "00</strong></td><td>" + T.pad(h) + ":30 = " + T.fmtClock(h * 60 + 30, false) +
        "</td><td>" + T.sayMilitary(h * 60) + "</td></tr>";
    }
    $("#mt-table").innerHTML = rows;
  }
  T.onInput(tool, function () { from12(); from24(); bulk(); });
  T.$$("[data-copy]", tool).forEach(function (b) {
    b.addEventListener("click", function () { T.copy(T.$(b.getAttribute("data-copy"), tool).textContent, "Copied"); });
  });
  table(); from12(); from24(); bulk(); now();
  setInterval(now, 15000);
})(typeof window !== "undefined" ? window : globalThis);
