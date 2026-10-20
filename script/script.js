(function () {
  "use strict";

  var DB_NAME = "RS_weekly_db";
  var STORE = "kv";
  var REC_KEY = "state";

  // セクションごとに枠線の色を分けるためのパレット
  var COLORS = ["#e0463c", "#3fa9f5", "#4ccf8a", "#f5b73f", "#b074f5", "#f56fa8", "#3fd6d0", "#f58a3f"];

  // 必須セクション(削除不可・名称固定)
  var REQUIRED = [
    { key: "hyperion", name: "ヒペリオン", color: 0 },
    { key: "tabiakuto", name: "タビアクート", color: 1 }
  ];

  var state = null;
  var db = null;
  var saveChain = Promise.resolve();
  var saveWarned = false;
  var modalAction = null;

  // 以下は保存しない(画面を開いている間だけ保持する)選択状態
  var selected = {};        // 一括追加の対象週課(未設定は選択済み扱い)
  var bulkAccountId = "";   // キャラ一括追加の追加先アカウント
  var suppAccountId = "";   // 補足情報エリアの追加先アカウント
  var drag = null;          // 週課内ドラッグ中の情報 { sid, cid, aid }
  var suppDrag = null;      // 補足情報内ドラッグ中の情報 { aid, name }

  function $(id) { return document.getElementById(id); }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function toHalf(s) {
    return String(s).replace(/[０-９]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    });
  }

  /* ================= IndexedDB ================= */
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function idbRun(mode, fn) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, mode);
      var req = fn(tx.objectStore(STORE));
      tx.oncomplete = function () { resolve(req ? req.result : undefined); };
      tx.onerror = tx.onabort = function () { reject(tx.error); };
    });
  }

  function warnSave(e) {
    console.error(e);
    if (!saveWarned) {
      saveWarned = true;
      alert("データを保存できませんでした。ブラウザの設定やストレージの空き容量を確認し、エクスポートでバックアップを取ってください。");
    }
  }

  function save() {
    if (!db) return;
    var snap = JSON.stringify(state);
    saveChain = saveChain.then(function () {
      return idbRun("readwrite", function (s) { return s.put(JSON.parse(snap), REC_KEY); });
    }).catch(warnSave);
  }

  function wipeStorage() {
    if (!db) return;
    saveChain = saveChain.then(function () {
      return idbRun("readwrite", function (s) { return s.clear(); });
    }).catch(warnSave);
  }

  /* ================= 状態 ================= */
  // 保存データ・インポートデータを安全な形に整える
  function normalize(d) {
    if (!d || typeof d !== "object") d = {};

    d.accounts = (Array.isArray(d.accounts) ? d.accounts : [])
      .filter(function (a) { return a && a.id != null; })
      .map(function (a) { return { id: String(a.id), name: a.name == null ? "" : String(a.name) }; });
    var ids = {};
    d.accounts.forEach(function (a) { ids[a.id] = true; });

    var usedKeys = {};
    d.sections = (Array.isArray(d.sections) ? d.sections : [])
      .filter(function (s) { return s && s.id != null; })
      .map(function (s) {
        var out = {
          id: String(s.id),
          name: s.name == null ? "" : String(s.name),
          color: isFinite(s.color) ? Math.max(0, Math.floor(s.color)) : 0,
          pick: typeof s.pick === "string" ? s.pick : "",
          chars: []
        };
        var isReq = REQUIRED.some(function (r) { return r.key === s.key; });
        if (isReq && !usedKeys[s.key]) { out.key = s.key; usedKeys[s.key] = true; }
        out.chars = (Array.isArray(s.chars) ? s.chars : [])
          .filter(function (c) { return c && ids[c.accountId]; })
          .map(function (c) {
            return {
              id: c.id != null ? String(c.id) : uid(),
              name: c.name == null ? "" : String(c.name),
              checked: !!c.checked,
              leader: !!c.leader,
              accountId: c.accountId,
              num: toHalf(c.num == null ? "" : c.num).replace(/\D/g, "").slice(0, 2)
            };
          });
        return out;
      });

    REQUIRED.forEach(function (r, i) {
      var f = null;
      d.sections.forEach(function (s) { if (s.key === r.key) f = s; });
      if (!f) {
        f = { id: uid(), key: r.key, name: r.name, color: r.color, pick: "", chars: [] };
        d.sections.splice(Math.min(i, d.sections.length), 0, f);
      }
      f.name = r.name;
    });

    d.extra = (Array.isArray(d.extra) ? d.extra : [])
      .filter(function (x) { return x && ids[x.accountId] && x.name; })
      .map(function (x) {
        return { id: x.id != null ? String(x.id) : uid(), name: String(x.name), accountId: x.accountId };
      });

    var notes = {};
    if (d.notes && typeof d.notes === "object") {
      Object.keys(d.notes).forEach(function (k) {
        var n = d.notes[k];
        if (!n || typeof n !== "object") return;
        var month = String(n.month == null ? "" : n.month);
        if (!/^(1[0-2]|[1-9])$/.test(month)) month = "";
        var memo = String(n.memo == null ? "" : n.memo);
        if (month || memo) notes[k] = { month: month, memo: memo };
      });
    }
    d.notes = notes;

    // 補足情報欄の並び順(アカウントID → キャラ名の配列)
    var so = {};
    if (d.suppOrder && typeof d.suppOrder === "object") {
      Object.keys(d.suppOrder).forEach(function (k) {
        if (!ids[k] || !Array.isArray(d.suppOrder[k])) return;
        var seen = {};
        so[k] = d.suppOrder[k].filter(function (n) {
          if (typeof n !== "string" || seen[n]) return false;
          seen[n] = true;
          return true;
        });
      });
    }
    d.suppOrder = so;
    return d;
  }

  function defaultState() {
    return normalize({ accounts: [], sections: [], extra: [], notes: {}, suppOrder: {} });
  }

  function nextColorIndex() {
    var used = state.sections.map(function (s) { return s.color; });
    for (var i = 0; i < COLORS.length; i++) {
      if (used.indexOf(i) === -1) return i;
    }
    return state.sections.length % COLORS.length;
  }

  function find(id) {
    for (var i = 0; i < state.sections.length; i++) {
      if (state.sections[i].id === id) return state.sections[i];
    }
    return null;
  }

  function findAccount(id) {
    if (!id) return null;
    for (var i = 0; i < state.accounts.length; i++) {
      if (state.accounts[i].id === id) return state.accounts[i];
    }
    return null;
  }

  function noteKey(accountId, name) { return accountId + "|" + name; }

  function nameExists(accountId, name) {
    var hit = state.sections.some(function (s) {
      return s.chars.some(function (c) { return c.accountId === accountId && c.name === name; });
    });
    if (hit) return true;
    return state.extra.some(function (x) { return x.accountId === accountId && x.name === name; });
  }

  // どこにも存在しないキャラの補足情報(月・メモ)を削除する
  function pruneNotes() {
    var valid = {};
    state.sections.forEach(function (s) {
      s.chars.forEach(function (c) { valid[noteKey(c.accountId, c.name)] = true; });
    });
    state.extra.forEach(function (x) { valid[noteKey(x.accountId, x.name)] = true; });
    Object.keys(state.notes).forEach(function (k) {
      if (!valid[k]) delete state.notes[k];
    });
  }

  function setNote(key, field, val) {
    var n = state.notes[key] || (state.notes[key] = { month: "", memo: "" });
    n[field] = val;
    if (!n.month && !n.memo) delete state.notes[key];
    save();
  }

  function sanitizePicks() {
    var changed = false;
    state.sections.forEach(function (s) {
      if (s.pick && !s.chars.some(function (c) { return c.id === s.pick; })) {
        s.pick = "";
        changed = true;
      }
    });
    if (changed) save();
  }

  /* ================= 操作 ================= */
  function addSection() {
    var custom = state.sections.filter(function (s) { return !s.key; }).length;
    state.sections.push({
      id: uid(),
      name: "週課 " + (custom + 1),
      color: nextColorIndex(),
      pick: "",
      chars: []
    });
    save();
    render();
  }

  // アカウントの登録のみ(週課側には追加しない)
  function addAccount() {
    var input = $("accountName");
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    var dup = state.accounts.some(function (a) { return a.name === name; });
    if (dup) { alert("同名のアカウントが既に存在します。"); return; }
    var a = { id: uid(), name: name };
    state.accounts.push(a);
    bulkAccountId = a.id;   // 追加したアカウントをキャラ追加先に選択
    input.value = "";
    save();
    renderAccountSelects();
    input.focus();
  }

  // 入力文字列を、空白(半角・全角・タブ・改行)とカンマで区切ってキャラ名の配列にする
  function splitNames(text) {
    var seen = {};
    var out = [];
    String(text).split(/[\s,，、]+/).forEach(function (n) {
      if (n && !seen[n]) { seen[n] = true; out.push(n); }
    });
    return out;
  }

  // 一括追加入力欄の高さを内容に合わせる(CSSのmax-heightまで)
  function growBulk() {
    var t = $("bulkName");
    t.style.height = "auto";
    t.style.height = t.scrollHeight + 2 + "px";
  }

  // 一括追加: チェック済みの週課すべてに、選択中アカウントのキャラを(複数まとめて)追加
  function bulkAdd() {
    if (!findAccount(bulkAccountId)) { alert("アカウントを選択してください"); return; }
    var input = $("bulkName");
    var names = splitNames(input.value);
    if (!names.length) { input.focus(); return; }

    var targets = state.sections.filter(function (s) { return selected[s.id] !== false; });
    if (!targets.length) { alert("追加先の週課を選択してください。"); return; }

    var leader = $("bulkLeader").checked;
    var added = 0;
    var skipped = {};
    var skippedList = [];

    targets.forEach(function (s) {
      names.forEach(function (name) {
        var dup = s.chars.some(function (c) { return c.accountId === bulkAccountId && c.name === name; });
        if (dup) {
          if (!skipped[name]) { skipped[name] = true; skippedList.push(name); }
          return;
        }
        s.chars.push({
          id: uid(),
          name: name,
          checked: false,
          leader: leader,
          accountId: bulkAccountId,
          num: ""
        });
        added++;
      });
    });

    if (!added) {
      alert("入力されたキャラは、選択した週課すべてに、このアカウントで既に登録されています。");
      return;
    }

    input.value = "";
    growBulk();
    save();
    render();
    input.focus();

    if (skippedList.length) {
      alert("次のキャラは、登録済みの週課ではスキップしました。\n" + skippedList.join("、"));
    }
  }

  // 補足情報エリア限定でキャラを追加(週課には追加されない)
  function suppAdd() {
    if (!findAccount(suppAccountId)) { alert("アカウントを選択してください"); return; }
    var input = $("suppName");
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    if (nameExists(suppAccountId, name)) {
      alert("このアカウントには同名のキャラが既に存在します。");
      return;
    }
    state.extra.push({ id: uid(), name: name, accountId: suppAccountId });
    input.value = "";
    save();
    renderSupp();
    input.focus();
  }

  // チェックボックスのみ全解除(ヒペリオン選択・数字・補足情報は保持)
  function clearAll() {
    state.sections.forEach(function (s) {
      s.chars.forEach(function (c) { c.checked = false; });
    });
    save();
    render();
  }

  // 全データを削除して初期状態へ
  function resetAll() {
    state = defaultState();
    selected = {};
    bulkAccountId = "";
    suppAccountId = "";
    $("bulkName").value = "";
    growBulk();
    $("accountName").value = "";
    $("suppName").value = "";
    $("bulkLeader").checked = false;
    wipeStorage();
    save();
    render();
  }

  /* ================= エクスポート / インポート ================= */
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function exportData() {
    var now = new Date();
    var payload = {
      app: "RS_weekly",
      version: 2,
      exportedAt: now.toISOString(),
      data: state
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
        next = normalize(d);
      } catch (e) {
        alert("読み込めないファイルです。このツールでエクスポートしたJSONファイルを選択してください。");
        return;
      }
      openConfirm({
        title: "データをインポートしますか?",
        text: "現在のデータはすべて、読み込んだファイルの内容で上書きされます。この操作は元に戻せません。必要であれば先にエクスポートしてください。",
        okLabel: "インポート",
        onOk: function () {
          state = next;
          selected = {};
          bulkAccountId = "";
          suppAccountId = "";
          save();
          render();
        }
      });
    };
    reader.onerror = function () { alert("ファイルを読み込めませんでした。"); };
    reader.readAsText(file);
  }

  /* ================= 進捗表示 ================= */
  function countText(chars) {
    var done = chars.filter(function (c) { return c.checked; }).length;
    return done + " / " + chars.length;
  }

  function refreshProgress() {
    var list = document.querySelectorAll(".section-progress");
    var i, n, s;
    for (i = 0; i < list.length; i++) {
      n = list[i];
      s = find(n.dataset.section);
      if (s) n.textContent = countText(s.chars);
    }
    list = document.querySelectorAll(".account-progress");
    for (i = 0; i < list.length; i++) {
      n = list[i];
      s = find(n.dataset.section);
      if (!s) continue;
      var acc = n.dataset.account;
      n.textContent = countText(s.chars.filter(function (c) { return c.accountId === acc; }));
    }
  }

  /* ================= キャラ名の文字を枠幅に合わせて自動縮小 ================= */
  var meter = document.createElement("span");
  meter.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;";
  document.body.appendChild(meter);

  var MIN_FONT_PX = 5;

  function fit(input) {
    input.style.fontSize = "";               // CSS基準サイズに戻す
    var text = input.value;
    if (!text) return;
    var w = input.clientWidth;
    if (!w) return;
    var cs = window.getComputedStyle(input);
    var base = parseFloat(cs.fontSize);
    meter.style.fontFamily = cs.fontFamily;
    meter.style.fontWeight = cs.fontWeight;
    meter.style.fontSize = base + "px";
    meter.textContent = text;
    var tw = meter.getBoundingClientRect().width;
    var avail = w - 1;
    if (tw > avail) {
      input.style.fontSize = Math.max(MIN_FONT_PX, base * avail / tw) + "px";
    }
  }

  function fitAll() {
    var list = document.querySelectorAll(".char-name");
    for (var i = 0; i < list.length; i++) fit(list[i]);
  }

  /* ================= ドラッグ＆ドロップ(週課内・同じアカウント内での並べ替え) ================= */
  function clearDrop() {
    var list = document.querySelectorAll(".drop-before, .drop-after, .drop-end");
    for (var i = 0; i < list.length; i++) {
      list[i].classList.remove("drop-before", "drop-after", "drop-end");
    }
  }

  function indexOfChar(s, id) {
    for (var i = 0; i < s.chars.length; i++) {
      if (s.chars[i].id === id) return i;
    }
    return -1;
  }

  // targetId があればその前後に、なければ同アカウントの末尾に移動
  function moveChar(s, charId, targetId, after, accountId) {
    var idx = indexOfChar(s, charId);
    if (idx < 0) return;
    var c = s.chars.splice(idx, 1)[0];
    var pos = -1;
    if (targetId) {
      var t = indexOfChar(s, targetId);
      pos = t < 0 ? s.chars.length : t + (after ? 1 : 0);
    } else {
      for (var i = 0; i < s.chars.length; i++) {
        if (s.chars[i].accountId === accountId) pos = i + 1;
      }
      if (pos < 0) pos = s.chars.length;
    }
    s.chars.splice(pos, 0, c);
  }

  function isAfter(e, row) {
    var r = row.getBoundingClientRect();
    return e.clientX > r.left + r.width / 2;
  }

  function canDrop(s, a) {
    return drag && drag.sid === s.id && drag.aid === a.id;
  }

  function bindCharDrag(row, handle, s, c, a) {
    // ハンドルを押したときだけカードをドラッグ可能にする
    handle.addEventListener("mousedown", function () { row.draggable = true; });
    handle.addEventListener("mouseup", function () { row.draggable = false; });

    row.addEventListener("dragstart", function (e) {
      drag = { sid: s.id, cid: c.id, aid: a.id };
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", c.id); } catch (err) {}
      try { e.dataTransfer.setDragImage(row, 20, 16); } catch (err) {}
      setTimeout(function () { row.classList.add("dragging"); }, 0);
    });

    row.addEventListener("dragend", function () {
      row.draggable = false;
      row.classList.remove("dragging");
      drag = null;
      clearDrop();
    });

    row.addEventListener("dragover", function (e) {
      if (!canDrop(s, a)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      clearDrop();
      if (drag.cid === c.id) return;
      row.classList.add(isAfter(e, row) ? "drop-after" : "drop-before");
    });

    row.addEventListener("drop", function (e) {
      if (!canDrop(s, a)) return;
      e.preventDefault();
      e.stopPropagation();
      if (drag.cid !== c.id) {
        moveChar(s, drag.cid, c.id, isAfter(e, row), a.id);
        save();
      }
      drag = null;
      clearDrop();
      render();
    });
  }

  function bindGridDrop(grid, s, a) {
    grid.addEventListener("dragover", function (e) {
      if (!canDrop(s, a)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearDrop();
      grid.classList.add("drop-end");
    });
    grid.addEventListener("drop", function (e) {
      if (!canDrop(s, a)) return;
      e.preventDefault();
      moveChar(s, drag.cid, null, false, a.id);
      save();
      drag = null;
      clearDrop();
      render();
    });
  }

  /* ================= 追加バー(週課チェック・アカウント選択) ================= */
  function renderTargets() {
    var box = $("bulkTargets");
    box.innerHTML = "";
    state.sections.forEach(function (s) {
      var label = el("label", "target");
      label.dataset.target = s.id;
      label.style.setProperty("--c", COLORS[s.color % COLORS.length]);

      var cb = el("input");
      cb.type = "checkbox";
      cb.checked = selected[s.id] !== false;
      cb.addEventListener("change", function () { selected[s.id] = cb.checked; });

      var txt = el("span", "target-text", s.name || "(無題)");
      label.appendChild(cb);
      label.appendChild(txt);
      box.appendChild(label);
    });
  }

  function fillAccountSelect(sel, currentId) {
    sel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = state.accounts.length ? "アカウントを選択してください" : "アカウントを追加してください";
    sel.appendChild(ph);
    state.accounts.forEach(function (a) {
      var o = document.createElement("option");
      o.value = a.id;
      o.textContent = a.name || "(無題)";
      sel.appendChild(o);
    });
    sel.value = findAccount(currentId) ? currentId : "";
    sel.classList.toggle("is-empty", !sel.value);
  }

  function renderAccountSelects() {
    if (!findAccount(bulkAccountId)) bulkAccountId = "";
    if (!findAccount(suppAccountId)) suppAccountId = "";
    fillAccountSelect($("bulkAccount"), bulkAccountId);
    fillAccountSelect($("suppAccount"), suppAccountId);
  }

  // アカウント名の変更を画面全体に反映(入力中の欄は再描画しない)
  function syncAccountNames(a, activeInput) {
    var label = a.name || "(無題)";
    var i, list;
    list = document.querySelectorAll(".account-name");
    for (i = 0; i < list.length; i++) {
      if (list[i] !== activeInput && list[i].dataset.account === a.id) list[i].value = a.name;
    }
    list = document.querySelectorAll("#bulkAccount option, #suppAccount option");
    for (i = 0; i < list.length; i++) {
      if (list[i].value === a.id) list[i].textContent = label;
    }
    list = document.querySelectorAll("optgroup");
    for (i = 0; i < list.length; i++) {
      if (list[i].dataset.account === a.id) list[i].label = label;
    }
    list = document.querySelectorAll(".supp-account-title");
    for (i = 0; i < list.length; i++) {
      if (list[i].dataset.account === a.id) list[i].textContent = label;
    }
  }

  /* ================= ヒペリオンのキャラ選択プルダウン ================= */
  function fillPick(sel, s) {
    sel.innerHTML = "";
    var none = document.createElement("option");
    none.value = "";
    none.textContent = "未選択";
    sel.appendChild(none);
    state.accounts.forEach(function (a) {
      var list = s.chars.filter(function (c) { return c.accountId === a.id; });
      if (!list.length) return;
      var g = document.createElement("optgroup");
      g.label = a.name || "(無題)";
      g.dataset.account = a.id;
      list.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.name || "(無名)";
        g.appendChild(o);
      });
      sel.appendChild(g);
    });
    sel.value = s.pick || "";
  }

  /* ================= 補足情報エリア ================= */
  // アカウント内の全キャラ名(重複は1件にまとめ、保存された並び順を反映する)
  function suppItems(accountId) {
    var seen = {};
    var items = [];
    state.sections.forEach(function (s) {
      s.chars.forEach(function (c) {
        if (c.accountId === accountId && c.name && !seen[c.name]) {
          seen[c.name] = true;
          items.push({ name: c.name, extraId: null });
        }
      });
    });
    state.extra.forEach(function (x) {
      if (x.accountId === accountId && x.name && !seen[x.name]) {
        seen[x.name] = true;
        items.push({ name: x.name, extraId: x.id });
      }
    });

    var order = state.suppOrder[accountId] || [];
    var byName = {};
    items.forEach(function (it) { byName[it.name] = it; });
    var out = [];
    var used = {};
    order.forEach(function (n) {
      if (byName[n] && !used[n]) { used[n] = true; out.push(byName[n]); }
    });
    items.forEach(function (it) {
      if (!used[it.name]) out.push(it);
    });
    return out;
  }

  // 補足情報の並べ替え: targetName の前後(なければ末尾)へ移動して順序を保存
  function suppMove(accountId, name, targetName, after) {
    var names = suppItems(accountId).map(function (it) { return it.name; });
    var from = names.indexOf(name);
    if (from < 0) return;
    names.splice(from, 1);
    var pos = names.length;
    if (targetName != null) {
      var t = names.indexOf(targetName);
      if (t >= 0) pos = t + (after ? 1 : 0);
    }
    names.splice(pos, 0, name);
    state.suppOrder[accountId] = names;
    save();
  }

  function isAfterY(e, row) {
    var r = row.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2;
  }

  function canSuppDrop(a) {
    return suppDrag && suppDrag.aid === a.id;
  }

  function bindSuppDrag(row, handle, a, name) {
    // ハンドルを押したときだけ行をドラッグ可能にする(入力欄の文字選択を妨げないため)
    handle.addEventListener("mousedown", function () { row.draggable = true; });
    handle.addEventListener("mouseup", function () { row.draggable = false; });

    row.addEventListener("dragstart", function (e) {
      suppDrag = { aid: a.id, name: name };
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", name); } catch (err) {}
      try { e.dataTransfer.setDragImage(row, 20, 16); } catch (err) {}
      setTimeout(function () { row.classList.add("dragging"); }, 0);
    });

    row.addEventListener("dragend", function () {
      row.draggable = false;
      row.classList.remove("dragging");
      suppDrag = null;
      clearDrop();
    });

    row.addEventListener("dragover", function (e) {
      if (!canSuppDrop(a)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      clearDrop();
      if (suppDrag.name === name) return;
      row.classList.add(isAfterY(e, row) ? "drop-after" : "drop-before");
    });

    row.addEventListener("drop", function (e) {
      if (!canSuppDrop(a)) return;
      e.preventDefault();
      e.stopPropagation();
      if (suppDrag.name !== name) {
        suppMove(a.id, suppDrag.name, name, isAfterY(e, row));
      }
      suppDrag = null;
      clearDrop();
      renderSupp();
    });
  }

  function bindSuppBlockDrop(blk, a) {
    // 行の外(ブロックの空き部分)にドロップしたら、そのアカウントの末尾へ
    blk.addEventListener("dragover", function (e) {
      if (!canSuppDrop(a)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearDrop();
      blk.classList.add("drop-end");
    });
    blk.addEventListener("drop", function (e) {
      if (!canSuppDrop(a)) return;
      e.preventDefault();
      suppMove(a.id, suppDrag.name, null, false);
      suppDrag = null;
      clearDrop();
      renderSupp();
    });
  }

  /* ---------- 月の入力コンボボックス(文字部分=数字入力 / ▾=一覧表示) ---------- */
  function closeMonthLists(except) {
    var list = document.querySelectorAll(".month-list.open");
    for (var i = 0; i < list.length; i++) {
      if (list[i] !== except) list[i].classList.remove("open");
    }
  }

  function buildMonthCombo(initial, onChange) {
    var cur = initial || "";

    var wrap = el("div", "month-combo");

    var input = el("input", "month-input");
    input.type = "text";
    input.setAttribute("inputmode", "numeric");
    input.maxLength = 2;
    input.autocomplete = "off";
    input.placeholder = "--";
    input.title = "数字を入力(1〜12)";
    input.value = cur;

    var unit = el("span", "month-unit", "月");

    var btn = el("button", "month-arrow", "▾");
    btn.type = "button";
    btn.tabIndex = -1;
    btn.title = "月を一覧から選択";

    var ul = el("ul", "month-list");
    var lis = [];

    function mark() {
      lis.forEach(function (li) { li.classList.toggle("sel", li.dataset.v === cur); });
    }

    function commit(v) {
      if (v === cur) return;
      cur = v;
      mark();
      onChange(v);
    }

    function choose(v) {
      input.value = v;
      commit(v);
      ul.classList.remove("open");
    }

    function addItem(v, label) {
      var li = el("li", null, label);
      li.dataset.v = v;
      // mousedownで処理し、入力欄のblurより先に確定させる
      li.addEventListener("mousedown", function (e) {
        e.preventDefault();
        choose(v);
      });
      ul.appendChild(li);
      lis.push(li);
    }
    addItem("", "--");
    for (var m = 1; m <= 12; m++) addItem(String(m), m + "月");
    mark();

    // 入力内容を整えて、1〜12なら即座に反映する
    function apply() {
      var v = toHalf(input.value).replace(/\D/g, "").slice(0, 2);
      if (v.length === 2 && parseInt(v, 10) > 12) v = v.slice(1);   // 13→3 のように最後の1桁を残す
      if (v !== input.value) input.value = v;
      if (v === "") {
        commit("");
      } else {
        var n = parseInt(v, 10);
        if (n >= 1 && n <= 12) commit(String(n));
        // 0 のみの場合は保持するだけ(確定せず、フォーカスが外れたら元に戻す)
      }
    }

    input.addEventListener("input", function (e) {
      if (e.isComposing) return;
      apply();
    });
    input.addEventListener("compositionend", apply);
    input.addEventListener("focus", function () {
      closeMonthLists();
      setTimeout(function () { input.select(); }, 0);   // 全選択して、そのまま上書き入力できるように
    });
    input.addEventListener("mouseup", function (e) {
      if (document.activeElement === input && input.selectionStart === 0 && input.selectionEnd === input.value.length) {
        e.preventDefault();   // クリック直後の選択解除を防ぐ
      }
    });
    input.addEventListener("blur", function () {
      input.value = cur;      // 無効な入力は確定済みの値に戻す
    });

    input.addEventListener("keydown", function (e) {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        apply();
        ul.classList.remove("open");
        input.blur();
      } else if (e.key === "Escape") {
        ul.classList.remove("open");
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        var n = cur === "" ? 0 : parseInt(cur, 10);
        n += e.key === "ArrowUp" ? -1 : 1;
        if (n < 1) n = 12;
        if (n > 12) n = 1;
        input.value = String(n);
        commit(String(n));
        input.select();
      }
    });

    btn.addEventListener("mousedown", function (e) { e.preventDefault(); });   // 入力欄のフォーカスを奪わない
    btn.addEventListener("click", function () {
      var willOpen = !ul.classList.contains("open");
      closeMonthLists(ul);
      ul.classList.toggle("open", willOpen);
      if (willOpen) {
        var sel = ul.querySelector("li.sel");
        if (sel) ul.scrollTop = sel.offsetTop - 40;
      }
    });

    wrap.appendChild(input);
    wrap.appendChild(unit);
    wrap.appendChild(btn);
    wrap.appendChild(ul);
    return wrap;
  }

  function renderSupp() {
    var box = $("suppList");
    box.innerHTML = "";
    var any = false;

    state.accounts.forEach(function (a) {
      var items = suppItems(a.id);
      if (!items.length) return;
      any = true;

      var blk = el("div", "supp-account");
      var title = el("h3", "supp-account-title", a.name || "(無題)");
      title.dataset.account = a.id;
      blk.appendChild(title);
      bindSuppBlockDrop(blk, a);

      items.forEach(function (it) {
        var key = noteKey(a.id, it.name);
        var n = state.notes[key] || { month: "", memo: "" };
        var row = el("div", "supp-row");

        var handle = el("span", "supp-handle");
        handle.title = "ドラッグして並べ替え";

        var nm = el("span", "supp-name", it.name);
        nm.title = it.name;

        var mo = buildMonthCombo(n.month || "", function (v) { setNote(key, "month", v); });

        var memo = el("textarea", "supp-memo");
        memo.rows = 1;
        memo.setAttribute("wrap", "off");
        memo.spellcheck = false;
        memo.placeholder = "補足を入力";
        memo.value = n.memo || "";
        memo.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && !e.isComposing) e.preventDefault();   // 1行入力
        });
        memo.addEventListener("input", function () {
          if (/[\r\n]/.test(memo.value)) memo.value = memo.value.replace(/[\r\n]+/g, " ");
          setNote(key, "memo", memo.value);
        });

        row.appendChild(handle);
        row.appendChild(nm);
        row.appendChild(mo);
        row.appendChild(memo);

        // この欄だけで追加したキャラ(週課に存在しないキャラ)は削除できる
        if (it.extraId) {
          var del = el("button", "btn-del", "✕");
          del.type = "button";
          del.title = "このキャラクターを補足情報から削除";
          del.addEventListener("click", function () {
            if (!confirm("キャラクター「" + it.name + "」を補足情報から削除しますか?\n入力した月・補足も削除されます。")) return;
            state.extra = state.extra.filter(function (x) { return x.id !== it.extraId; });
            pruneNotes();
            save();
            renderSupp();
          });
          row.appendChild(del);
        }
        bindSuppDrag(row, handle, a, it.name);
        blk.appendChild(row);
      });
      box.appendChild(blk);
    });

    if (!any) {
      box.appendChild(el("p", "empty-hint", "キャラクターがまだありません。「キャラ追加」で登録すると、ここにアカウントごとに一覧表示されます。"));
    }
  }

  /* ================= 週課セクションの描画 ================= */
  function renderSections() {
    var root = $("sections");
    root.innerHTML = "";

    state.sections.forEach(function (s) {
      var req = !!s.key;
      var box = el("section", "section");
      box.dataset.section = s.id;
      box.style.setProperty("--c", COLORS[s.color % COLORS.length]);

      // 週課ヘッダー
      var head = el("div", "section-head");
      var name = el("input", "section-name" + (req ? " fixed" : ""));
      name.type = "text";
      name.value = s.name;
      name.placeholder = "週課名";
      if (req) {
        name.readOnly = true;      // 必須セクションは名称固定
        name.tabIndex = -1;
      } else {
        name.addEventListener("input", function () {
          s.name = name.value;
          var t = document.querySelector('[data-target="' + s.id + '"] .target-text');
          if (t) t.textContent = s.name || "(無題)";
          save();
        });
      }
      head.appendChild(name);

      // ヒペリオン: 登録キャラの選択(翌週に装備を持つキャラ)
      if (s.key === "hyperion") {
        var pick = el("select", "section-pick");
        pick.title = "翌週に装備を持つキャラ(クリアしても保持されます)";
        fillPick(pick, s);
        pick.addEventListener("change", function () {
          s.pick = pick.value;
          save();
        });
        var labelSpan = document.createElement("span");
        labelSpan.textContent = "とどめ保持："; // ここに好きな文字を入れてください
        head.appendChild(labelSpan);
        head.appendChild(pick);
      }

      var progress = el("span", "section-progress");
      progress.dataset.section = s.id;
      head.appendChild(progress);

      // 必須セクション以外のみ削除可能
      if (!req) {
        var delSec = el("button", "btn-del", "✕");
        delSec.type = "button";
        delSec.title = "このセクションを削除";
        delSec.addEventListener("click", function () {
          if (!confirm("セクション「" + s.name + "」を削除しますか?")) return;
          state.sections = state.sections.filter(function (x) { return x.id !== s.id; });
          delete selected[s.id];
          pruneNotes();
          save();
          render();
        });
        head.appendChild(delSec);
      }
      box.appendChild(head);

      if (!s.chars.length) {
        box.appendChild(el("p", "empty-hint", "上部の「キャラ追加」からキャラクターを追加できます"));
      }

      // アカウントごとのサブセクション(キャラが存在するアカウントのみ表示)
      state.accounts.forEach(function (a) {
        var list = s.chars.filter(function (c) { return c.accountId === a.id; });
        if (!list.length) return;

        var acc = el("div", "account");
        acc.dataset.account = a.id;

        var ah = el("div", "account-head");
        var an = el("input", "account-name");
        an.type = "text";
        an.value = a.name;
        an.placeholder = "アカウント名";
        an.dataset.account = a.id;
        an.addEventListener("input", function () {
          a.name = an.value;
          syncAccountNames(a, an);
          save();
        });

        var ap = el("span", "account-progress");
        ap.dataset.section = s.id;
        ap.dataset.account = a.id;

        // この週課を、このアカウントでは実行しない(アカウント自体は削除しない)
        var delAcc = el("button", "btn-del", "✕");
        delAcc.type = "button";
        delAcc.title = "この週課からこのアカウントを外す";
        delAcc.addEventListener("click", function () {
          var msg = "週課「" + s.name + "」から、アカウント「" + (a.name || "無題") +
            "」のキャラクターをすべて削除しますか?\n(アカウント自体や他の週課には影響しません)";
          if (!confirm(msg)) return;
          s.chars = s.chars.filter(function (c) { return c.accountId !== a.id; });
          pruneNotes();
          save();
          render();
        });

        ah.appendChild(an);
        ah.appendChild(ap);
        ah.appendChild(delAcc);
        acc.appendChild(ah);

        // キャラクター(1行5列。タビアクートのみ1行4列。増えた分だけ自動で高さが伸びる)
        var isTabi = s.key === "tabiakuto";
        var grid = el("div", "chars" + (isTabi ? " cols4" : ""));
        bindGridDrop(grid, s, a);

        list.forEach(function (c) {
          var row = el("div", "char" + (c.checked ? " done" : "") + (c.leader ? " leader" : ""));

          var handle = el("span", "drag-handle");
          handle.title = "ドラッグして並べ替え";

          var cb = el("input");
          cb.type = "checkbox";
          cb.checked = !!c.checked;
          cb.addEventListener("change", function () {
            c.checked = cb.checked;
            row.classList.toggle("done", c.checked);
            refreshProgress();
            save();
          });

          // キャラ名: 表示専用(編集不可)。クリックでチェックを切り替える
          var nm = el("input", "char-name");
          nm.type = "text";
          nm.value = c.name;
          nm.readOnly = true;
          nm.tabIndex = -1;
          nm.title = "クリック: チェック切替";

          var actions = el("div", "char-actions");

          var ld = el("button", "btn-leader" + (c.leader ? " on" : ""), "引");
          ld.type = "button";
          ld.title = "引率キャラの切り替え";
          ld.addEventListener("click", function () {
            c.leader = !c.leader;
            row.classList.toggle("leader", c.leader);
            ld.classList.toggle("on", c.leader);
            save();
          });

          var del = el("button", "btn-char-del", "✕");
          del.type = "button";
          del.title = "このキャラクターを削除";
          del.addEventListener("click", function () {
            s.chars = s.chars.filter(function (x) { return x.id !== c.id; });
            pruneNotes();
            save();
            render();
          });

          actions.appendChild(ld);
          actions.appendChild(del);

          row.appendChild(handle);
          row.appendChild(cb);
          row.appendChild(nm);
          row.appendChild(actions);

          // カード内(名前・余白)のクリックでチェックを切り替える
          row.addEventListener("click", function (e) {
            var t = e.target;
            if (t === cb) return;                                   // チェックボックス自身は標準動作
            if (t.closest && (t.closest(".drag-handle") || t.closest(".char-actions"))) return;
            cb.click();
          });

          bindCharDrag(row, handle, s, c, a);

          if (isTabi) {
            // タビアクート: キャラ名ごとの数字(2桁まで)を、カードの外・右横に配置
            var cell = el("div", "char-cell");
            var num = el("input", "char-num");
            num.type = "text";
            num.setAttribute("inputmode", "numeric");
            num.maxLength = 2;
            num.autocomplete = "off";
            num.placeholder = "00";
            num.title = "数字(2桁まで)";
            num.value = c.num || "";
            var applyNum = function () {
              var v = toHalf(num.value).replace(/\D/g, "").slice(0, 2);
              if (v !== num.value) num.value = v;
              c.num = v;
              save();
            };
            num.addEventListener("input", function (e) {
              if (e.isComposing) return;
              applyNum();
            });
            num.addEventListener("compositionend", applyNum);
            cell.appendChild(row);
            cell.appendChild(num);
            grid.appendChild(cell);
          } else {
            grid.appendChild(row);
          }
        });

        acc.appendChild(grid);
        box.appendChild(acc);
      });

      root.appendChild(box);
    });
  }

  function render() {
    sanitizePicks();
    renderSections();
    renderTargets();
    renderAccountSelects();
    renderSupp();
    refreshProgress();
    fitAll();   // DOMに追加された後でサイズを計算
  }

  /* ================= 確認ダイアログ・ヘルプダイアログ ================= */
  var modal = $("modal");
  var helpModal = $("helpModal");

  function openConfirm(o) {
    $("modalTitle").textContent = o.title;
    $("modalText").textContent = o.text;
    $("modalOk").textContent = o.okLabel;
    modalAction = o.onOk;
    modal.classList.add("open");
    $("modalCancel").focus();   // 誤操作防止のためキャンセルに初期フォーカス
  }

  function closeModal() {
    modal.classList.remove("open");
    modalAction = null;
  }

  function openHelp() {
    helpModal.classList.add("open");
    $("helpClose").focus();
  }

  function closeHelp() {
    helpModal.classList.remove("open");
  }

  /* ================= 起動 ================= */
  function bindEvents() {
    $("resetFab").addEventListener("click", function () {
      openConfirm({
        title: "全データを初期化しますか?",
        text: "保存されているすべてのデータ(アカウント、キャラクター、補足情報、ヒペリオンの選択内容を含む)を削除し、「ヒペリオン」「タビアクート」だけの初期状態に戻します。この操作は元に戻せません。必要であれば先にエクスポートしてください。",
        okLabel: "初期化",
        onOk: resetAll
      });
    });
    $("modalCancel").addEventListener("click", closeModal);
    $("modalOk").addEventListener("click", function () {
      var f = modalAction;
      closeModal();
      if (f) f();
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });

    // ヘルプ
    $("helpBtn").addEventListener("click", openHelp);
    $("helpClose").addEventListener("click", closeHelp);
    helpModal.addEventListener("click", function (e) {
      if (e.target === helpModal) closeHelp();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (helpModal.classList.contains("open")) closeHelp();
        if (modal.classList.contains("open")) closeModal();
        closeMonthLists();
      }
    });

    // 月の一覧の外側をクリックしたら閉じる
    document.addEventListener("mousedown", function (e) {
      if (!e.target.closest || !e.target.closest(".month-combo")) closeMonthLists();
    });

    $("addSection").addEventListener("click", addSection);
    $("clearBtn").addEventListener("click", clearAll);
    $("bulkAdd").addEventListener("click", bulkAdd);
    $("accountAdd").addEventListener("click", addAccount);
    $("suppAdd").addEventListener("click", suppAdd);

    $("bulkAccount").addEventListener("change", function () {
      bulkAccountId = $("bulkAccount").value;
      $("bulkAccount").classList.toggle("is-empty", !bulkAccountId);
    });
    $("suppAccount").addEventListener("change", function () {
      suppAccountId = $("suppAccount").value;
      $("suppAccount").classList.toggle("is-empty", !suppAccountId);
    });

    function enter(id, fn) {
      $(id).addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); fn(); }
      });
    }
    enter("accountName", addAccount);
    enter("suppName", suppAdd);

    // キャラ一括追加: Enterで追加、Shift+Enterで改行。入力に応じて高さを自動調整
    $("bulkName").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        bulkAdd();
      }
    });
    $("bulkName").addEventListener("input", growBulk);
    growBulk();

    $("exportBtn").addEventListener("click", exportData);
    $("importBtn").addEventListener("click", function () { $("importFile").click(); });
    $("importFile").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importFile(f);
      e.target.value = "";   // 同じファイルを再選択できるようにする
    });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { fitAll(); growBulk(); }, 60);
    });
  }

  function start() {
    openDB()
      .then(function (d) {
        db = d;
        return idbRun("readonly", function (s) { return s.get(REC_KEY); });
      })
      .then(function (rec) {
        state = rec ? normalize(rec) : defaultState();
      })
      .catch(function (e) {
        // 読み込めない場合、既存データを上書きしないよう保存を無効にする
        console.error(e);
        db = null;
        state = defaultState();
        alert("IndexedDBを利用できないため、データの保存・復元ができません。ブラウザの設定を確認してください。");
      })
      .then(function () {
        bindEvents();
        render();
        // ブラウザによる自動削除の対象外にするよう要求(許可はブラウザ次第)
        if (navigator.storage && navigator.storage.persist) {
          navigator.storage.persist().catch(function () {});
        }
      });
  }

  start();
})();
