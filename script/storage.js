// IndexedDB の読み書き
(function () {
  "use strict";

  var RS = window.RS;
  var saveChain = Promise.resolve();
  var saveWarned = false;

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

  RS.save = function () {
    if (!RS.db) return;
    var snap = JSON.stringify(RS.state);
    saveChain = saveChain.then(function () {
      return RS.idbRun("readwrite", function (s) { return s.put(JSON.parse(snap), RS.REC_KEY); });
    }).catch(warnSave);
  };

  RS.wipeStorage = function () {
    if (!RS.db) return;
    saveChain = saveChain.then(function () {
      return RS.idbRun("readwrite", function (s) { return s.clear(); });
    }).catch(warnSave);
  };
})();