// 補足情報エリア(表示キャラの管理・月入力・メモ・並べ替え)
(function () {
  "use strict";

  var RS = window.RS;
  var $ = RS.$, el = RS.el, uid = RS.uid, toHalf = RS.toHalf, noteKey = RS.noteKey;

  /* ================= 表示対象の取得 ================= */
  // アカウント内の表示対象キャラ(重複は1件にまとめ、保存された並び順を反映する)
  // 週課のキャラは「表示に追加」したものだけ。この欄だけで追加したキャラは常に表示。
  function suppItems(accountId) {
    var st = RS.state;
    var extraByName = {};
    st.extra.forEach(function (x) {
      if (x.accountId === accountId && x.name) extraByName[x.name] = x.id;
    });

    var seen = {};
    var items = [];
    st.sections.forEach(function (s) {
      s.chars.forEach(function (c) {
        if (c.accountId !== accountId || !c.name || seen[c.name]) return;
        seen[c.name] = true;
        if (extraByName[c.name]) items.push({ name: c.name, extraId: extraByName[c.name] });
        else if (RS.isSuppShown(accountId, c.name)) items.push({ name: c.name, extraId: null });
      });
    });
    st.extra.forEach(function (x) {
      if (x.accountId === accountId && x.name && !seen[x.name]) {
        seen[x.name] = true;
        items.push({ name: x.name, extraId: x.id });
      }
    });

    var order = st.suppOrder[accountId] || [];
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

  // 補足情報にまだ表示していない週課キャラ(アカウントごとに重複なし)
  function suppUnshown() {
    var out = [];
    RS.state.accounts.forEach(function (a) {
      var seen = {};
      RS.state.sections.forEach(function (s) {
        s.chars.forEach(function (c) {
          if (c.accountId !== a.id || !c.name || seen[c.name]) return;
          seen[c.name] = true;
          if (!RS.isSuppShown(a.id, c.name) && !RS.extraHasName(a.id, c.name)) out.push({ a: a, name: c.name });
        });
      });
    });
    return out;
  }

  /* ================= 表示・非表示・追加 ================= */
  // 週課のキャラを補足情報欄に表示する
  function showSupp(accountId, name) {
    var shown = RS.state.suppShown;
    var list = shown[accountId] || (shown[accountId] = []);
    if (list.indexOf(name) < 0) list.push(name);
    RS.save();
    renderSupp();
  }

  // 補足情報欄から外す(週課側のデータ・月・メモは残す)
  function hideSupp(accountId, name) {
    var shown = RS.state.suppShown;
    var list = shown[accountId];
    if (!list) return;
    list = list.filter(function (n) { return n !== name; });
    if (list.length) shown[accountId] = list;
    else delete shown[accountId];
    RS.save();
    renderSupp();
  }

  // 補足情報エリア限定でキャラを追加(週課には追加されない)。未表示の週課キャラと同名なら表示に追加する
  function suppAdd() {
    var accountId = RS.suppAccountId;
    if (!RS.findAccount(accountId)) { alert("アカウントを選択してください"); return; }
    var input = $("suppName");
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    if (RS.nameExists(accountId, name)) {
      if (RS.sectionHasName(accountId, name) && !RS.extraHasName(accountId, name) && !RS.isSuppShown(accountId, name)) {
        showSupp(accountId, name);
        input.value = "";
        input.focus();
        return;
      }
      alert("このアカウントには同名のキャラが既に存在します。");
      return;
    }
    RS.state.extra.push({ id: uid(), name: name, accountId: accountId });
    input.value = "";
    RS.save();
    renderSupp();
    input.focus();
  }

  /* ================= 並べ替え(ドラッグ&ドロップ) ================= */
  // targetName の前後(なければ末尾)へ移動して順序を保存
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
    RS.state.suppOrder[accountId] = names;
    RS.save();
  }

  function isAfterY(e, row) {
    var r = row.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2;
  }

  function canSuppDrop(a) {
    return RS.suppDrag && RS.suppDrag.aid === a.id;
  }

  function bindSuppDrag(row, handle, a, name) {
    // ハンドルを押したときだけ行をドラッグ可能にする(入力欄の文字選択を妨げないため)
    handle.addEventListener("mousedown", function () { row.draggable = true; });
    handle.addEventListener("mouseup", function () { row.draggable = false; });

    row.addEventListener("dragstart", function (e) {
      RS.suppDrag = { aid: a.id, name: name };
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", name); } catch (err) {}
      try { e.dataTransfer.setDragImage(row, 20, 16); } catch (err) {}
      setTimeout(function () { row.classList.add("dragging"); }, 0);
    });

    row.addEventListener("dragend", function () {
      row.draggable = false;
      row.classList.remove("dragging");
      RS.suppDrag = null;
      RS.clearDrop();
    });

    row.addEventListener("dragover", function (e) {
      if (!canSuppDrop(a)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      RS.clearDrop();
      if (RS.suppDrag.name === name) return;
      row.classList.add(isAfterY(e, row) ? "drop-after" : "drop-before");
    });

    row.addEventListener("drop", function (e) {
      if (!canSuppDrop(a)) return;
      e.preventDefault();
      e.stopPropagation();
      if (RS.suppDrag.name !== name) {
        suppMove(a.id, RS.suppDrag.name, name, isAfterY(e, row));
      }
      RS.suppDrag = null;
      RS.clearDrop();
      renderSupp();
    });
  }

  function bindSuppBlockDrop(blk, a) {
    // 行の外(ブロックの空き部分)にドロップしたら、そのアカウントの末尾へ
    blk.addEventListener("dragover", function (e) {
      if (!canSuppDrop(a)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      RS.clearDrop();
      blk.classList.add("drop-end");
    });
    blk.addEventListener("drop", function (e) {
      if (!canSuppDrop(a)) return;
      e.preventDefault();
      suppMove(a.id, RS.suppDrag.name, null, false);
      RS.suppDrag = null;
      RS.clearDrop();
      renderSupp();
    });
  }

  /* ================= 月の入力コンボボックス(文字部分=数字入力 / ▾=一覧表示) ================= */
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

  /* ================= 描画 ================= */
  // 補足情報に追加できるキャラの一覧(クリックで表示に追加)
  function renderSuppPool() {
    var box = $("suppPool");
    box.innerHTML = "";
    var chips = suppUnshown();
    box.classList.toggle("has", chips.length > 0);
    if (!chips.length) return;

    box.appendChild(el("p", "supp-pool-title", "補足情報に追加できるキャラ(クリックで一覧に追加します)"));
    var list = el("div", "supp-pool-list");
    chips.forEach(function (c) {
      var chip = el("button", "pool-chip", (c.a.name || "(無題)") + " / " + c.name + "  ＋");
      chip.type = "button";
      chip.dataset.account = c.a.id;
      chip.dataset.name = c.name;
      chip.title = "補足情報に追加する";
      chip.addEventListener("click", function () { showSupp(c.a.id, c.name); });
      list.appendChild(chip);
    });
    box.appendChild(list);
  }

  function renderSupp() {
    var box = $("suppList");
    box.innerHTML = "";
    var any = false;

    RS.state.accounts.forEach(function (a) {
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
        var n = RS.state.notes[key] || { month: "", memo: "" };
        var row = el("div", "supp-row");

        var handle = el("span", "supp-handle");
        handle.title = "ドラッグして並べ替え";

        var nm = el("span", "supp-name", it.name);
        nm.title = it.name;

        var mo = buildMonthCombo(n.month || "", function (v) { RS.setNote(key, "month", v); });

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
          RS.setNote(key, "memo", memo.value);
        });

        row.appendChild(handle);
        row.appendChild(nm);
        row.appendChild(mo);
        row.appendChild(memo);

        if (it.extraId) {
          // この欄だけで追加したキャラ: 完全に削除(月・補足も消える)
          var del = el("button", "btn-del", "✕");
          del.type = "button";
          del.title = "このキャラクターを補足情報から削除";
          del.addEventListener("click", function () {
            if (!confirm("キャラクター「" + it.name + "」を補足情報から削除しますか?\n入力した月・補足も削除されます。")) return;
            RS.state.extra = RS.state.extra.filter(function (x) { return x.id !== it.extraId; });
            RS.pruneNotes();
            RS.save();
            renderSupp();
          });
          row.appendChild(del);
        } else {
          // 週課のキャラ: この欄から外すだけ(週課側・月・補足は残る)
          var hide = el("button", "btn-hide", "非表示");
          hide.type = "button";
          hide.title = "補足情報欄から外します(週課のキャラは削除されません)";
          hide.addEventListener("click", function () { hideSupp(a.id, it.name); });
          row.appendChild(hide);
        }
        bindSuppDrag(row, handle, a, it.name);
        blk.appendChild(row);
      });
      box.appendChild(blk);
    });

    if (!any) {
      box.appendChild(el("p", "empty-hint", suppUnshown().length
        ? "補足情報に表示するキャラがありません。下の一覧から追加してください。"
        : "キャラクターがまだありません。「キャラ追加」で登録するか、週課にキャラを追加してください。"));
    }
    renderSuppPool();
  }
  RS.renderSupp = renderSupp;

  /* ================= イベント登録 ================= */
  RS.bindSupp = function () {
    $("suppAdd").addEventListener("click", suppAdd);

    $("suppAccount").addEventListener("change", function () {
      RS.suppAccountId = $("suppAccount").value;
      $("suppAccount").classList.toggle("is-empty", !RS.suppAccountId);
    });

    $("suppName").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); suppAdd(); }
    });

    // 月の一覧の外側をクリックしたら閉じる
    document.addEventListener("mousedown", function (e) {
      if (!e.target.closest || !e.target.closest(".month-combo")) closeMonthLists();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMonthLists();
    });
  };
})();