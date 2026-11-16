// 補足情報欄の最下部「自由メモ」(入力内容は保存・エクスポート対象)
(function () {
  "use strict";

  var RS = window.RS;
  var $ = RS.$;

  // 保存済みの内容を画面に反映(入力中の内容と同じなら何もしない)
  RS.renderFreeMemo = function () {
    var t = $("freeMemo");
    var v = RS.state.memoText || "";
    if (t.value !== v) t.value = v;
  };

  RS.bindFreeMemo = function () {
    $("freeMemo").addEventListener("input", function () {
      RS.state.memoText = $("freeMemo").value;
      RS.save();
    });
  };
})();