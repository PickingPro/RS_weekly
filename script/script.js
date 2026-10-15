(function () {
  "use strict";

  var STORAGE_KEY = "RS_weekly_v1";
  // セクションごとに枠線の色を分けるためのパレット
  var COLORS = ["#e0463c", "#3fa9f5", "#4ccf8a", "#f5b73f", "#b074f5", "#f56fa8", "#3fd6d0", "#f58a3f"];

  // 一括追加の対象週課の選択状態(セクションID → true/false)。未設定は選択済み扱い
  var selected = {};
  // 一括追加の追加先アカウント
  var bulkAccountId = null;
  // ドラッグ中の情報 { sid, cid }
  var drag = null;

  var state = load();

  function $(id) { return document.getElementById(id); }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function defaultState() {
    return {
      accounts: [{ id: uid(), name: "アカウント1" }],
      sections: [
        { id: uid(), name: "ヒペリオン", color: 0, chars: [] },
        { id: uid(), name: "タビアクート", color: 1, chars: [] }
      ]
    };
  }

  // 旧バージョンのデータ(アカウントなし)も読み込めるように整える
  function normalize(d) {
    if (!Array.isArray(d.accounts) || !d.accounts.length) {
      d.accounts = [{ id: uid(), name: "アカウント1" }];
    }
    var ids = {};
    d.accounts.forEach(function (a) { ids[a.id] = true; });
    var first = d.accounts[0].id;
    d.sections.forEach(function (s) {
      if (!Array.isArray(s.chars)) s.chars = [];
      s.chars.forEach(function (c) {
        if (!c.accountId || !ids[c.accountId]) c.accountId = first;
        c.leader = !!c.leader;
        c.checked = !!c.checked;
      });
    });
    return d;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.sections)) return normalize(d);
      }
    } catch (e) {}
    return defaultState();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
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
    for (var i = 0; i < state.accounts.length; i++) {
      if (state.accounts[i].id === id) return state.accounts[i];
    }
    return null;
  }

  function addSection() {
    state.sections.push({
      id: uid(),
      name: "週課 " + (state.sections.length + 1),
      color: nextColorIndex(),
      chars: []
    });
    save();
    render();
  }

  // 全週課にアカウントのセクションを追加(アカウントは全週課共通)
  function addAccount() {
    var input = $("accountName");
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    var a = { id: uid(), name: name };
    state.accounts.push(a);
    bulkAccountId = a.id;   // 追加したアカウントを追加先に選択
    input.value = "";
    save();
    render();
    input.focus();
  }

  function deleteAccount(a) {
    if (!confirm("アカウント「" + (a.name || "無題") + "」と、全週課内のこのアカウントのキャラクターをすべて削除しますか?")) return;
    state.accounts = state.accounts.filter(function (x) { return x.id !== a.id; });
    state.sections.forEach(function (s) {
      s.chars = s.chars.filter(function (c) { return c.accountId !== a.id; });
    });
    if (bulkAccountId === a.id) bulkAccountId = null;
    save();
    render();
  }

  // 一括追加: チェック済みの週課すべての、選択中アカウントにキャラ名を追加
  function bulkAdd() {
    var input = $("bulkName");
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    if (!findAccount(bulkAccountId)) return;

    var leader = $("bulkLeader").checked;
    var added = false;
    state.sections.forEach(function (s) {
      if (selected[s.id] !== false) {
        s.chars.push({
          id: uid(),
          name: name,
          checked: false,
          leader: leader,
          accountId: bulkAccountId
        });
        added = true;
      }
    });
    if (!added) return;

    input.value = "";
    save();
    render();
    input.focus();
  }

  // チェックボックスのみ全解除
  function clearAll() {
    state.sections.forEach(function (s) {
      s.chars.forEach(function (c) { c.checked = false; });
    });
    save();
    render();
  }

  // 全データを削除して初期状態へ
  function resetAll() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    state = defaultState();
    selected = {};
    bulkAccountId = null;
    $("bulkName").value = "";
    $("accountName").value = "";
    $("bulkLeader").checked = false;
    save();
    render();
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---------- 進捗表示 ---------- */
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

  /* ---------- キャラ名の文字を枠幅に合わせて自動縮小 ---------- */
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

  /* ---------- ドラッグ＆ドロップによる並べ替え ---------- */
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

  // targetId があればその前後に、なければ指定アカウントの末尾に移動
  function moveChar(s, charId, targetId, after, accountId) {
    var idx = indexOfChar(s, charId);
    if (idx < 0) return;
    var c = s.chars.splice(idx, 1)[0];
    c.accountId = accountId;
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

  function bindCharDrag(row, handle, s, c, a) {
    // ハンドルを押したときだけカードをドラッグ可能にする(入力欄の文字選択を妨げないため)
    handle.addEventListener("mousedown", function () { row.draggable = true; });
    handle.addEventListener("mouseup", function () { row.draggable = false; });

    row.addEventListener("dragstart", function (e) {
      drag = { sid: s.id, cid: c.id };
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
      if (!drag || drag.sid !== s.id) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (drag.cid === c.id) { clearDrop(); return; }
      clearDrop();
      row.classList.add(isAfter(e, row) ? "drop-after" : "drop-before");
    });

    row.addEventListener("drop", function (e) {
      if (!drag || drag.sid !== s.id) return;
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
      if (!drag || drag.sid !== s.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearDrop();
      grid.classList.add("drop-end");
    });
    grid.addEventListener("drop", function (e) {
      if (!drag || drag.sid !== s.id) return;
      e.preventDefault();
      moveChar(s, drag.cid, null, false, a.id);
      save();
      drag = null;
      clearDrop();
      render();
    });
  }

  /* ---------- 一括追加バー ---------- */
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

  function renderAccountSelect() {
    var sel = $("bulkAccount");
    sel.innerHTML = "";
    if (!findAccount(bulkAccountId)) {
      bulkAccountId = state.accounts.length ? state.accounts[0].id : null;
    }
    state.accounts.forEach(function (a) {
      var o = document.createElement("option");
      o.value = a.id;
      o.textContent = a.name || "(無題)";
      o.selected = a.id === bulkAccountId;
      sel.appendChild(o);
    });
  }

  /* ---------- 描画 ---------- */
  function render() {
    var root = $("sections");
    root.innerHTML = "";

    state.sections.forEach(function (s) {
      var box = el("section", "section");
      box.dataset.section = s.id;
      box.style.setProperty("--c", COLORS[s.color % COLORS.length]);

      // 週課ヘッダー
      var head = el("div", "section-head");
      var name = el("input", "section-name");
      name.type = "text";
      name.value = s.name;
      name.placeholder = "週課名";
      name.addEventListener("input", function () {
        s.name = name.value;
        var t = document.querySelector('[data-target="' + s.id + '"] .target-text');
        if (t) t.textContent = s.name || "(無題)";
        save();
      });

      var progress = el("span", "section-progress");
      progress.dataset.section = s.id;

      var delSec = el("button", "btn-del", "✕");
      delSec.type = "button";
      delSec.title = "このセクションを削除";
      delSec.addEventListener("click", function () {
        if (!confirm("セクション「" + s.name + "」を削除しますか?")) return;
        state.sections = state.sections.filter(function (x) { return x.id !== s.id; });
        delete selected[s.id];
        save();
        render();
      });

      head.appendChild(name);
      head.appendChild(progress);
      head.appendChild(delSec);
      box.appendChild(head);

      // アカウントごとのサブセクション
      state.accounts.forEach(function (a) {
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
          // 他の週課の同じアカウント名欄と、追加先プルダウンも追従
          var names = document.querySelectorAll(".account-name");
          for (var i = 0; i < names.length; i++) {
            if (names[i] !== an && names[i].dataset.account === a.id) names[i].value = a.name;
          }
          var opts = $("bulkAccount").options;
          for (var j = 0; j < opts.length; j++) {
            if (opts[j].value === a.id) opts[j].textContent = a.name || "(無題)";
          }
          save();
        });

        var ap = el("span", "account-progress");
        ap.dataset.section = s.id;
        ap.dataset.account = a.id;

        ah.appendChild(an);
        ah.appendChild(ap);

        // 最後の1アカウントは削除できない
        if (state.accounts.length > 1) {
          var delAcc = el("button", "btn-del", "✕");
          delAcc.type = "button";
          delAcc.title = "このアカウントを全週課から削除";
          delAcc.addEventListener("click", function () { deleteAccount(a); });
          ah.appendChild(delAcc);
        }
        acc.appendChild(ah);

        // キャラクター(1行5列、増えた分だけ自動で高さが伸びる)
        var grid = el("div", "chars");
        bindGridDrop(grid, s, a);

        s.chars.filter(function (c) { return c.accountId === a.id; }).forEach(function (c) {
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

          var nm = el("input", "char-name");
          nm.type = "text";
          nm.value = c.name;
          nm.placeholder = "キャラ名";
          nm.addEventListener("input", function () {
            c.name = nm.value;
            fit(nm);
            save();
          });

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
            save();
            render();
          });

          actions.appendChild(ld);
          actions.appendChild(del);

          row.appendChild(handle);
          row.appendChild(cb);
          row.appendChild(nm);
          row.appendChild(actions);
          bindCharDrag(row, handle, s, c, a);
          grid.appendChild(row);
        });

        acc.appendChild(grid);
        box.appendChild(acc);
      });

      root.appendChild(box);
    });

    renderTargets();
    renderAccountSelect();
    refreshProgress();
    fitAll();   // DOMに追加された後でサイズを計算
  }

  /* ---------- 初期化の確認ダイアログ ---------- */
  var modal = $("modal");

  function openModal() {
    modal.classList.add("open");
    $("modalCancel").focus();
  }
  function closeModal() {
    modal.classList.remove("open");
  }

  $("resetFab").addEventListener("click", openModal);
  $("modalCancel").addEventListener("click", closeModal);
  $("modalOk").addEventListener("click", function () {
    closeModal();
    resetAll();
  });
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
  });

  $("addSection").addEventListener("click", addSection);
  $("clearBtn").addEventListener("click", clearAll);
  $("bulkAdd").addEventListener("click", bulkAdd);
  $("accountAdd").addEventListener("click", addAccount);
  $("bulkAccount").addEventListener("change", function () { bulkAccountId = $("bulkAccount").value; });
  $("bulkName").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); bulkAdd(); }
  });
  $("accountName").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); addAccount(); }
  });

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitAll, 60);
  });

  render();
})();
