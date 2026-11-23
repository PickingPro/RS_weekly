// 描画の統合・イベント登録・起動(最後に読み込む)
(function () {
  "use strict";

  var RS = window.RS;

  // 週課ページの描画(レイドは RS.renderRaid で別に描画する)
  RS.render = function () {
    RS.sanitizePicks();
    RS.renderSections();
    RS.renderTargets();
    RS.renderAccountSelects();
    RS.renderSupp();
    RS.renderFreeMemo();
    RS.refreshProgress();
    RS.fitAll();   // DOMに追加された後でサイズを計算
  };

  function bindEvents() {
    RS.bindDialogs();
    RS.bindAddBar();
    RS.bindBackup();
    RS.bindActions();
    RS.bindSupp();
    RS.bindFreeMemo();
    RS.bindSectionDrop();
    RS.bindRaid();
    RS.bindView();

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        RS.fitAll();
        RS.growBulk();
        RS.growRaidBulk();
      }, 60);
    });
  }

  function start() {
    RS.openDB()
      .then(function (d) {
        RS.db = d;
        return RS.idbRun("readonly", function (s) { return s.get(RS.REC_KEY); });
      })
      .then(function (rec) {
        RS.state = rec ? RS.normalize(rec) : RS.defaultState();
        return RS.idbRun("readonly", function (s) { return s.get(RS.RAID_KEY); });
      })
      .then(function (raid) {
        RS.raid = raid ? RS.normalizeRaid(raid) : RS.defaultRaid();
      })
      .catch(function (e) {
        // 読み込めない場合、既存データを上書きしないよう保存を無効にする
        console.error(e);
        RS.db = null;
        RS.state = RS.defaultState();
        RS.raid = RS.defaultRaid();
        alert("IndexedDBを利用できないため、データの保存・復元ができません。ブラウザの設定を確認してください。");
      })
      .then(function () {
        bindEvents();
        RS.render();
        RS.renderRaid();
        // アカウントが1件もないときは、追加メニューを開いた状態で始める
        if (!RS.state.accounts.length) RS.setAddPanel(true);
        // ブラウザによる自動削除の対象外にするよう要求(許可はブラウザ次第)
        if (navigator.storage && navigator.storage.persist) {
          navigator.storage.persist().catch(function () {});
        }
      });
  }

  start();
})();