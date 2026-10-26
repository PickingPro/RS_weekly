// クリア数・完了表示・タビかけ合計
(function () {
  "use strict";

  var RS = window.RS;

  // 週課見出し用: 「クリア数 / 総数」
  function countText(chars) {
    var done = chars.filter(function (c) { return c.checked; }).length;
    return done + " / " + chars.length;
  }

  // アカウント見出し用: 「クリア済み/キャラ数」(スペースなし)
  function ratio(chars) {
    var done = chars.filter(function (c) { return c.checked; }).length;
    return done + "/" + chars.length;
  }

  // 「引率：x/y　寄生：x/y　総数：x/y」(引率が0人のときは「引率：0/0」)
  function accountText(chars) {
    var leaders = chars.filter(function (c) { return c.leader; });
    var others = chars.filter(function (c) { return !c.leader; });
    return "引率：" + ratio(leaders) + "　寄生：" + ratio(others) + "　総数：" + ratio(chars);
  }

  function allChecked(chars) {
    return chars.length > 0 && chars.every(function (c) { return c.checked; });
  }

  // タビアクートの数字(全アカウント分)の合計。空欄は0として扱う
  RS.tabiSum = function (s) {
    var sum = 0;
    s.chars.forEach(function (c) {
      var n = parseInt(c.num, 10);
      if (isFinite(n)) sum += n;
    });
    return sum;
  };

  RS.refreshTabiSum = function () {
    var list = document.querySelectorAll(".tabi-sum");
    for (var i = 0; i < list.length; i++) {
      var s = RS.find(list[i].dataset.section);
      if (s) list[i].textContent = "タビかけ：" + RS.tabiSum(s);
    }
  };

  RS.refreshProgress = function () {
    var list = document.querySelectorAll(".section-progress");
    var i, n, s, box, done, st;
    for (i = 0; i < list.length; i++) {
      n = list[i];
      s = RS.find(n.dataset.section);
      if (!s) continue;
      n.textContent = countText(s.chars);
      box = n.closest(".section");
      done = allChecked(s.chars);
      if (box) {
        box.classList.toggle("complete", done);
        st = box.querySelector(".section-status");
        if (st) st.textContent = done ? "完了" : "未完了";
      }
    }
    list = document.querySelectorAll(".account-progress");
    for (i = 0; i < list.length; i++) {
      n = list[i];
      s = RS.find(n.dataset.section);
      if (!s) continue;
      var acc = n.dataset.account;
      var chars = s.chars.filter(function (c) { return c.accountId === acc; });
      n.textContent = accountText(chars);
      box = n.closest(".account");
      if (box) box.classList.toggle("complete", allChecked(chars));
    }
    RS.refreshTabiSum();
  };
})();