// ページ切り替え(週課 / レイド)。URLは変えず、表示の切り替えのみ行う
(function () {
  "use strict";

  var RS = window.RS;
  var $ = RS.$;

  RS.view = "weekly";
  var raidOpened = false;

  RS.setView = function (v) {
    RS.view = v;
    var raid = v === "raid";

    $("weeklyView").hidden = raid;
    $("raidView").hidden = !raid;
    $("addPanel").hidden = raid;
    $("raidAddPanel").hidden = !raid;

    $("switchBtn").textContent = raid ? "週課" : "レイド";
    $("switchBtn").title = raid ? "週課のページに切り替えます" : "レイドのページに切り替えます";
    $("viewLabel").textContent = raid ? "レイド" : "週課";
    $("resetFab").title = raid ? "レイドのデータを初期化" : "週課のデータを初期化";

    // 初めてレイドを開くとき、アカウントが無ければ追加メニューを開いておく
    if (raid && !raidOpened) {
      raidOpened = true;
      if (!RS.raid.accounts.length) $("raidAddPanel").classList.remove("collapsed");
    }
    RS.syncAddBtn();

    window.scrollTo(0, 0);
    RS.fitAll();           // 非表示中は幅が取れないため、表示後に再計算する
    RS.growBulk();
    RS.growRaidBulk();
  };

  RS.bindView = function () {
    $("switchBtn").addEventListener("click", function () {
      RS.setView(RS.view === "raid" ? "weekly" : "raid");
    });
  };
})();