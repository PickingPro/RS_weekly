// IndexedDB の読み書き(週課=state、レイド=raid は別のキーで保存する)
(function () {
  "use strict";

  var RS = window.RS;
  var saveChain = Promise.resolve();
  var saveWarned = false;

  RS.RAID_KEY = "raid";

  RS.openDB = function () {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      var r = indexedDB.open(RS.DB_NAME, 1);
      r.onupgradeneeded = function () {
        if (!r.result.objectStoreNames.contains(RS.STORE)) r.result.createObjectStore(RS.STORE);
      };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  };

  RS.idbRun = function (mode, fn) {
    return new Promise(function (resolve, reject) {
      var tx = RS.db.transaction(RS.STORE, mode);
      var req = fn(tx.objectStore(RS.STORE));
      tx.oncomplete = function () { resolve(req ? req.result : undefined); };
      tx.onerror = tx.onabort = function () { reject(tx.error); };
    });
  };

  function warnSave(e) {
    console.error(e);
    if (!saveWarned) {
      saveWarned = true;
      alert("データを保存できませんでした。ブラウザの設定やストレージの空き容量を確認し、エクスポートでバックアップを取ってください。");
    }
  }

  function put(key, value) {
    if (!RS.db) return;
    var snap = JSON.stringify(value);
    saveChain = saveChain.then(function () {
      return RS.idbRun("readwrite", function (s) { return s.put(JSON.parse(snap), key); });
    }).catch(warnSave);
  }

  // 週課のデータを保存
  RS.save = function () { put(RS.REC_KEY, RS.state); };

  // レイドのデータを保存
  RS.saveRaid = function () { put(RS.RAID_KEY, RS.raid); };

  // 週課のデータだけを削除する(レイドのデータは消さない)
  RS.wipeStorage = function () {
    if (!RS.db) return;
    saveChain = saveChain.then(function () {
      return RS.idbRun("readwrite", function (s) { return s.delete(RS.REC_KEY); });
    }).catch(warnSave);
  };

  // レイドのデータだけを削除する(週課のデータは消さない)
  RS.wipeRaid = function () {
    if (!RS.db) return;
    saveChain = saveChain.then(function () {
      return RS.idbRun("readwrite", function (s) { return s.delete(RS.RAID_KEY); });
    }).catch(warnSave);
  };
})();