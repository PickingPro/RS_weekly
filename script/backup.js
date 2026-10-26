// エクスポート / インポート
(function () {
  "use strict";

  var RS = window.RS;
  var $ = RS.$, pad = RS.pad;

  function exportData() {
    var now = new Date();
    var payload = {
      app: "RS_weekly",
      version: 3,
      exportedAt: now.toISOString(),
      data: RS.state
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "RS_weekly_backup_" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
      "-" + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var next;
      try {
        var obj = JSON.parse(String(reader.result));
        var d = obj && obj.data ? obj.data : obj;
        if (!d || !Array.isArray(d.sections) || !Array.isArray(d.accounts)) throw new Error("format");
        next = RS.normalize(d);
      } catch (e) {
        alert("読み込めないファイルです。このツールでエクスポートしたJSONファイルを選択してください。");
        return;
      }
      RS.openConfirm({
        title: "データをインポートしますか?",
        text: "現在のデータはすべて、読み込んだファイルの内容で上書きされます。この操作は元に戻せません。必要であれば先にエクスポートしてください。",
        okLabel: "インポート",
        onOk: function () {
          RS.hideToast();
          RS.state = next;
          RS.selected = {};
          RS.bulkAccountId = "";
          RS.suppAccountId = "";
          RS.save();
          RS.render();
        }
      });
    };
    reader.onerror = function () { alert("ファイルを読み込めませんでした。"); };
    reader.readAsText(file);
  }

  RS.bindBackup = function () {
    $("exportBtn").addEventListener("click", exportData);
    $("importBtn").addEventListener("click", function () { $("importFile").click(); });
    $("importFile").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importFile(f);
      e.target.value = "";   // 同じファイルを再選択できるようにする
    });
  };
})();