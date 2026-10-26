// 共通の定数・状態・ユーティリティ(最初に読み込む)
(function () {
  "use strict";

  var RS = window.RS = window.RS || {};

  RS.DB_NAME = "RS_weekly_db";
  RS.STORE = "kv";
  RS.REC_KEY = "state";
  RS.UNDO_MS = 5000;   // クリアを元に戻せる時間

  // セクションごとに枠線の色を分けるためのパレット
  RS.COLORS = ["#e0463c", "#3fa9f5", "#4ccf8a", "#f5b73f", "#b074f5", "#f56fa8", "#3fd6d0", "#f58a3f"];

  // 必須セクション(削除不可・名称固定)
  RS.REQUIRED = [
    { key: "hyperion", name: "ヒペリオン", color: 0 },
    { key: "tabiakuto", name: "タビアクート", color: 1 }
  ];

  // 保存されるデータ本体と、DB接続
  RS.state = null;
  RS.db = null;

  // 以下は保存しない(画面を開いている間だけ保持する)選択状態
  RS.selected = {};        // 一括追加の対象週課(未設定は選択済み扱い)
  RS.bulkAccountId = "";   // キャラ一括追加の追加先アカウント
  RS.suppAccountId = "";   // 補足情報エリアの追加先アカウント
  RS.drag = null;          // 週課内ドラッグ中の情報 { sid, cid, aid }
  RS.suppDrag = null;      // 補足情報内ドラッグ中の情報 { aid, name }

  RS.$ = function (id) { return document.getElementById(id); };

  RS.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  RS.el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  RS.toHalf = function (s) {
    return String(s).replace(/[０-９]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    });
  };

  RS.noteKey = function (accountId, name) { return accountId + "|" + name; };

  RS.pad = function (n) { return (n < 10 ? "0" : "") + n; };
})();