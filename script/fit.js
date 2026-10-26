// キャラ名の文字を枠幅に合わせて自動縮小
(function () {
  "use strict";

  var RS = window.RS;
  var MIN_FONT_PX = 5;

  var meter = document.createElement("span");
  meter.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;";
  document.body.appendChild(meter);

  RS.fit = function (input) {
    input.style.fontSize = "";               // CSS基準サイズに戻す
    var text = input.value;
    if (!text) return;
    var w = input.clientWidth;
    if (!w) return;
    var cs = window.getComputedStyle(input);
    var base = parseFloat(cs.fontSize);
    meter.style.fontFamily = cs.fontFamily;
    meter.style.fontWeight = cs.fontWeight;
    meter.style.fontSize = base + "px";
    meter.textContent = text;
    var tw = meter.getBoundingClientRect().width;
    var avail = w - 1;
    if (tw > avail) {
      input.style.fontSize = Math.max(MIN_FONT_PX, base * avail / tw) + "px";
    }
  };

  RS.fitAll = function () {
    var list = document.querySelectorAll(".char-name");
    for (var i = 0; i < list.length; i++) RS.fit(list[i]);
  };
})();