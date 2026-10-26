// 週課の追加・クリア(元に戻す付き)・全データ初期化
(function () {
  "use strict";

  var RS = window.RS;
  var $ = RS.$, uid = RS.uid;

  /* ---------- 週課の追加 ---------- */
  function addSection() {
    var custom = RS.state.sections.filter(function (s) { return !s.key; }).length;
    RS.state.sections.push({
      id: uid(),
      name: "週課 " + (custom + 1),
      color: RS.nextColorIndex(),
      pick: "",
      pickTame: "",
      ticket: "",
      chars: []
    });
    RS.save();
    RS.render();
  }

  /* ---------- クリア(確認 → 実行 → 5秒間だけ元に戻せる) ---------- */
  function checkedIds() {
    var out = [];
    RS.state.sections.forEach(function (s) {
      s.chars.forEach(function (c) { if (c.checked) out.push(c.id); });
    });
    return out;
  }

  // チェックボックスのみ全解除(ヒペリオン選択・数字・チケット・補足情報は保持)
  function doClear() {
    var ids = checkedIds();
    if (!ids.length) return;
    RS.state.sections.forEach(function (s) {
      s.chars.forEach(function (c) { c.checked = false; });
    });
    RS.save();
    RS.render();
    RS.showToast(ids.length + "件のチェックを外しました", function () { undoClear(ids); }, RS.UNDO_MS);
  }

  // 外したチェックだけを復元する(その間に行った他の変更は戻さない)
  function undoClear(ids) {
    var set = {};
    ids.forEach(function (id) { set[id] = true; });
    RS.state.sections.forEach(function (s) {
      s.chars.forEach(function (c) { if (set[c.id]) c.checked = true; });
    });
    RS.save();
    RS.render();
  }

  function requestClear() {
    if (!checkedIds().length) {
      RS.showToast("チェック済みのキャラはありません", null, 2500);
      return;
    }
    RS.openConfirm({
      title: "チェックをすべて外しますか?",
      text: "全キャラのチェックを外します。ヒペリオンの選択、タビアクートの数字・チケット、補足情報は消えません。\n実行後、5秒間だけ「元に戻す」で取り消せます。",
      okLabel: "クリア",
      onOk: doClear
    });
  }

  /* ---------- 全データを削除して初期状態へ ---------- */
  function resetAll() {
    RS.hideToast();
    RS.state = RS.defaultState();
    RS.selected = {};
    RS.bulkAccountId = "";
    RS.suppAccountId = "";
    $("bulkName").value = "";
    RS.growBulk();
    $("accountName").value = "";
    $("suppName").value = "";
    $("bulkLeader").checked = false;
    RS.wipeStorage();
    RS.save();
    RS.render();
  }

  RS.bindActions = function () {
    $("addSection").addEventListener("click", addSection);
    $("clearBtn").addEventListener("click", requestClear);
    $("resetFab").addEventListener("click", function () {
      RS.openConfirm({
        title: "全データを初期化しますか?",
        text: "保存されているすべてのデータ(アカウント、キャラクター、補足情報、ヒペリオンの選択内容を含む)を削除し、「ヒペリオン」「タビアクート」だけの初期状態に戻します。この操作は元に戻せません。必要であれば先にエクスポートしてください。",
        okLabel: "初期化",
        onOk: resetAll
      });
    });
  };
})();