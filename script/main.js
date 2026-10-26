// 描画の統合・イベント登録・起動(最後に読み込む)
(function () {
  "use strict";

  var RS = window.RS;

  RS.render = function () {
    RS.sanitizePicks();
    RS.renderSections();
    RS.renderTargets();
    RS.renderAccountSelects();
    RS.renderSupp();
    RS.refreshProgress();
    RS.fitAll();   // DOMに追加された後でサイズを計算
  };

  function bindEvents() {
    RS.bindDialogs();
    RS.bindAddBar();
    RS.bindBackup();
    RS.bindActions();
    RS.bindSupp();

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { RS.fitAll(); RS.growBulk(); }, 60);
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
      })
      .catch(function (e) {
        // 読み込めない場合、既存データを上書きしないよう保存を無効にする
        console.error(e);
        RS.db = null;
        RS.state = RS.defaultState();
        alert("IndexedDBを利用できないため、データの保存・復元ができません。ブラウザの設定を確認してください。");
      })
      .then(function () {
        bindEvents();
        RS.render();
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