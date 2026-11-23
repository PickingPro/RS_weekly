// レイドページ(週課とは独立したデータ。キャラごとに0〜3のカウンター)
(function () {
  "use strict";

  var RS = window.RS;
  var $ = RS.$, el = RS.el, uid = RS.uid;

  var MAX = 3;

  // 必須セクション(削除不可・名称固定)
  var REQ = [
    { key: "skeleton", name: "骸骨王", color: 0 },
    { key: "dragote", name: "ドラゴート", color: 1 },
    { key: "somel", name: "ソメル・ノチェス", color: 2 },
    { key: "cerberus", name: "ケルベロス", color: 3 }
  ];

  RS.raid = null;              // レイドのデータ { accounts, sections }
  RS.raidSelected = {};        // 一括追加の対象セクション(未設定は選択済み扱い)
  RS.raidBulkAccountId = "";   // 一括追加の追加先アカウント

  /* ================= データ ================= */
  RS.normalizeRaid = function (d) {
    if (!d || typeof d !== "object") d = {};

    d.accounts = (Array.isArray(d.accounts) ? d.accounts : [])
      .filter(function (a) { return a && a.id != null; })
      .map(function (a) { return { id: String(a.id), name: a.name == null ? "" : String(a.name) }; });
    var ids = {};
    d.accounts.forEach(function (a) { ids[a.id] = true; });

    var used = {};
    d.sections = (Array.isArray(d.sections) ? d.sections : [])
      .filter(function (s) { return s && s.id != null; })
      .map(function (s) {
        var out = {
          id: String(s.id),
          name: s.name == null ? "" : String(s.name),
          color: isFinite(s.color) ? Math.max(0, Math.floor(s.color)) : 0,
          chars: []
        };
        var isReq = REQ.some(function (r) { return r.key === s.key; });
        if (isReq && !used[s.key]) { out.key = s.key; used[s.key] = true; }
        out.chars = (Array.isArray(s.chars) ? s.chars : [])
          .filter(function (c) { return c && ids[c.accountId]; })
          .map(function (c) {
            var n = parseInt(c.count, 10);
            return {
              id: c.id != null ? String(c.id) : uid(),
              name: c.name == null ? "" : String(c.name),
              accountId: c.accountId,
              count: isFinite(n) ? Math.min(MAX, Math.max(0, n)) : 0
            };
          });
        return out;
      });

    REQ.forEach(function (r, i) {
      var f = null;
      d.sections.forEach(function (s) { if (s.key === r.key) f = s; });
      if (!f) {
        f = { id: uid(), key: r.key, name: r.name, color: r.color, chars: [] };
        d.sections.splice(Math.min(i, d.sections.length), 0, f);
      }
      f.name = r.name;
    });
    return d;
  };

  RS.defaultRaid = function () {
    return RS.normalizeRaid({ accounts: [], sections: [] });
  };

  function rfind(id) {
    var list = RS.raid.sections;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function rfindAccount(id) {
    if (!id) return null;
    var list = RS.raid.accounts;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function nextColor() {
    var used = RS.raid.sections.map(function (s) { return s.color; });
    for (var i = 0; i < RS.COLORS.length; i++) {
      if (used.indexOf(i) === -1) return i;
    }
    return RS.raid.sections.length % RS.COLORS.length;
  }

  /* ================= 集計・完了表示 ================= */
  function sum(chars) {
    return chars.reduce(function (t, c) { return t + c.count; }, 0);
  }
  function allMax(chars) {
    return chars.length > 0 && chars.every(function (c) { return c.count >= MAX; });
  }
  function ratioText(chars) {
    return sum(chars) + " / " + chars.length * MAX;
  }

  function refreshRaidProgress() {
    var list = document.querySelectorAll("#raidSections .section-progress");
    var i, n, s, box, done, st;
    for (i = 0; i < list.length; i++) {
      n = list[i];
      s = rfind(n.dataset.rsec);
      if (!s) continue;
      n.textContent = ratioText(s.chars);
      box = n.closest(".section");
      done = allMax(s.chars);
      if (box) {
        box.classList.toggle("complete", done);
        st = box.querySelector(".section-status");
        if (st) st.textContent = done ? "完了" : "未完了";
      }
    }
    list = document.querySelectorAll("#raidSections .account-progress");
    for (i = 0; i < list.length; i++) {
      n = list[i];
      s = rfind(n.dataset.rsec);
      if (!s) continue;
      var acc = n.dataset.racc;
      var chars = s.chars.filter(function (c) { return c.accountId === acc; });
      n.textContent = ratioText(chars);
      box = n.closest(".account");
      if (box) box.classList.toggle("complete", allMax(chars));
    }
  }

  /* ================= 追加メニュー ================= */
  function splitNames(text) {
    var seen = {};
    var out = [];
    String(text).split(/[\s,，、]+/).forEach(function (n) {
      if (n && !seen[n]) { seen[n] = true; out.push(n); }
    });
    return out;
  }

  function growRaidBulk() {
    var t = $("raidBulkName");
    if (!t.offsetParent) return;
    t.style.height = "auto";
    t.style.height = t.scrollHeight + 2 + "px";
  }
  RS.growRaidBulk = growRaidBulk;

  function addAccount() {
    var input = $("raidAccountName");
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    if (RS.raid.accounts.some(function (a) { return a.name === name; })) {
      alert("同名のアカウントが既に存在します。");
      return;
    }
    var a = { id: uid(), name: name };
    RS.raid.accounts.push(a);
    RS.raidBulkAccountId = a.id;
    input.value = "";
    RS.saveRaid();
    renderAccountSelect();
    input.focus();
  }

  function bulkAdd() {
    if (!rfindAccount(RS.raidBulkAccountId)) { alert("アカウントを選択してください"); return; }
    var input = $("raidBulkName");
    var names = splitNames(input.value);
    if (!names.length) { input.focus(); return; }

    var targets = RS.raid.sections.filter(function (s) { return RS.raidSelected[s.id] !== false; });
    if (!targets.length) { alert("追加先のセクションを選択してください。"); return; }

    var accountId = RS.raidBulkAccountId;
    var added = 0;
    var skipped = {};
    var skippedList = [];

    targets.forEach(function (s) {
      names.forEach(function (name) {
        var dup = s.chars.some(function (c) { return c.accountId === accountId && c.name === name; });
        if (dup) {
          if (!skipped[name]) { skipped[name] = true; skippedList.push(name); }
          return;
        }
        s.chars.push({ id: uid(), name: name, accountId: accountId, count: 0 });
        added++;
      });
    });

    if (!added) {
      alert("入力されたキャラは、選択したセクションすべてに、このアカウントで既に登録されています。");
      return;
    }

    input.value = "";
    growRaidBulk();
    RS.saveRaid();
    RS.renderRaid();
    input.focus();

    if (skippedList.length) {
      alert("次のキャラは、登録済みのセクションではスキップしました。\n" + skippedList.join("、"));
    }
  }

  function renderAccountSelect() {
    if (!rfindAccount(RS.raidBulkAccountId)) RS.raidBulkAccountId = "";
    var sel = $("raidBulkAccount");
    sel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = RS.raid.accounts.length ? "アカウントを選択してください" : "アカウントを追加してください";
    sel.appendChild(ph);
    RS.raid.accounts.forEach(function (a) {
      var o = document.createElement("option");
      o.value = a.id;
      o.textContent = a.name || "(無題)";
      sel.appendChild(o);
    });
    sel.value = RS.raidBulkAccountId;
    sel.classList.toggle("is-empty", !sel.value);
  }

  function renderTargets() {
    var box = $("raidBulkTargets");
    box.innerHTML = "";
    RS.raid.sections.forEach(function (s) {
      var label = el("label", "target");
      label.dataset.rtarget = s.id;
      label.style.setProperty("--c", RS.COLORS[s.color % RS.COLORS.length]);

      var cb = el("input");
      cb.type = "checkbox";
      cb.checked = RS.raidSelected[s.id] !== false;
      cb.addEventListener("change", function () { RS.raidSelected[s.id] = cb.checked; });

      label.appendChild(cb);
      label.appendChild(el("span", "target-text", s.name || "(無題)"));
      box.appendChild(label);
    });
  }

  // アカウント名の変更を、他の欄にも反映
  function syncAccountNames(a, activeInput) {
    var label = a.name || "(無題)";
    var i, list = document.querySelectorAll("#raidSections .account-name");
    for (i = 0; i < list.length; i++) {
      if (list[i] !== activeInput && list[i].dataset.raccount === a.id) list[i].value = a.name;
    }
    list = $("raidBulkAccount").options;
    for (i = 0; i < list.length; i++) {
      if (list[i].value === a.id) list[i].textContent = label;
    }
  }

  /* ================= 描画 ================= */
  function buildChar(s, c) {
    var row = el("div", "rchar");

    var nm = el("input", "char-name");
    nm.type = "text";
    nm.value = c.name;
    nm.readOnly = true;
    nm.tabIndex = -1;

    var ctl = el("div", "rchar-ctl");
    var minus = el("button", "rchar-btn", "−");
    minus.type = "button";
    minus.title = "1つ減らす";
    var n = el("span", "rchar-n");
    n.title = "カウント(0〜" + MAX + ")";
    var plus = el("button", "rchar-btn", "+");
    plus.type = "button";
    plus.title = "1つ増やす";

    function upd() {
      n.textContent = c.count;
      row.classList.toggle("max", c.count >= MAX);
      minus.disabled = c.count <= 0;
      plus.disabled = c.count >= MAX;
    }
    function step(d) {
      var v = Math.min(MAX, Math.max(0, c.count + d));
      if (v === c.count) return;
      c.count = v;
      upd();
      refreshRaidProgress();
      RS.saveRaid();
    }
    minus.addEventListener("click", function () { step(-1); });
    plus.addEventListener("click", function () { step(1); });
    upd();

    ctl.appendChild(minus);
    ctl.appendChild(n);
    ctl.appendChild(plus);

    var actions = el("div", "char-actions");
    var del = el("button", "btn-char-del", "✕");
    del.type = "button";
    del.title = "このキャラクターを削除";
    del.addEventListener("click", function () {
      s.chars = s.chars.filter(function (x) { return x.id !== c.id; });
      RS.saveRaid();
      RS.renderRaid();
    });
    actions.appendChild(del);

    row.appendChild(nm);
    row.appendChild(ctl);
    row.appendChild(actions);
    return row;
  }

  function buildAccount(s, a, list) {
    var acc = el("div", "account");
    acc.dataset.raccount = a.id;

    var ah = el("div", "account-head");
    var an = el("input", "account-name");
    an.type = "text";
    an.value = a.name;
    an.placeholder = "アカウント名";
    an.dataset.raccount = a.id;
    an.addEventListener("input", function () {
      a.name = an.value;
      syncAccountNames(a, an);
      RS.saveRaid();
    });

    var ap = el("span", "account-progress");
    ap.dataset.rsec = s.id;
    ap.dataset.racc = a.id;

    // このセクションを、このアカウントでは実行しない(アカウント自体は削除しない)
    var delAcc = el("button", "btn-del", "✕");
    delAcc.type = "button";
    delAcc.title = "このセクションからこのアカウントを外す";
    delAcc.addEventListener("click", function () {
      var msg = "「" + s.name + "」から、アカウント「" + (a.name || "無題") +
        "」のキャラクターをすべて削除しますか?\n(アカウント自体や他のセクションには影響しません)";
      if (!confirm(msg)) return;
      s.chars = s.chars.filter(function (c) { return c.accountId !== a.id; });
      RS.saveRaid();
      RS.renderRaid();
    });

    ah.appendChild(an);
    ah.appendChild(el("span", "done-badge", "完了"));
    ah.appendChild(ap);
    ah.appendChild(delAcc);
    acc.appendChild(ah);

    var grid = el("div", "rchars");
    list.forEach(function (c) { grid.appendChild(buildChar(s, c)); });
    acc.appendChild(grid);
    return acc;
  }

  function buildHead(s, req) {
    var head = el("div", "section-head");
    head.appendChild(el("span", "section-status", "未完了"));

    var name = el("input", "section-name" + (req ? " fixed" : ""));
    name.type = "text";
    name.value = s.name;
    name.placeholder = "セクション名";
    if (req) {
      name.readOnly = true;
      name.tabIndex = -1;
    } else {
      name.addEventListener("input", function () {
        s.name = name.value;
        var t = document.querySelector('[data-rtarget="' + s.id + '"] .target-text');
        if (t) t.textContent = s.name || "(無題)";
        RS.saveRaid();
      });
    }
    head.appendChild(name);

    var progress = el("span", "section-progress");
    progress.dataset.rsec = s.id;
    head.appendChild(progress);

    if (!req) {
      var delSec = el("button", "btn-del", "✕");
      delSec.type = "button";
      delSec.title = "このセクションを削除";
      delSec.addEventListener("click", function () {
        if (!confirm("セクション「" + s.name + "」を削除しますか?")) return;
        RS.raid.sections = RS.raid.sections.filter(function (x) { return x.id !== s.id; });
        delete RS.raidSelected[s.id];
        RS.saveRaid();
        RS.renderRaid();
      });
      head.appendChild(delSec);
    }
    return head;
  }

  function renderSections() {
    var root = $("raidSections");
    root.innerHTML = "";

    RS.raid.sections.forEach(function (s) {
      var box = el("section", "section");
      box.dataset.rsec = s.id;
      box.style.setProperty("--c", RS.COLORS[s.color % RS.COLORS.length]);
      box.appendChild(buildHead(s, !!s.key));

      if (!s.chars.length) {
        box.appendChild(el("p", "empty-hint", "上部の「追加メニュー」からキャラクターを追加できます"));
      }
      RS.raid.accounts.forEach(function (a) {
        var list = s.chars.filter(function (c) { return c.accountId === a.id; });
        if (!list.length) return;
        box.appendChild(buildAccount(s, a, list));
      });
      root.appendChild(box);
    });
  }

  RS.renderRaid = function () {
    renderSections();
    renderTargets();
    renderAccountSelect();
    refreshRaidProgress();
    RS.fitAll();
  };

  /* ================= 操作 ================= */
  function addSection() {
    var custom = RS.raid.sections.filter(function (s) { return !s.key; }).length;
    RS.raid.sections.push({
      id: uid(),
      name: "レイド " + (custom + 1),
      color: nextColor(),
      chars: []
    });
    RS.saveRaid();
    RS.renderRaid();
  }

  // カウントが1以上のキャラ → { id: カウント }
  function nonZero() {
    var out = {};
    RS.raid.sections.forEach(function (s) {
      s.chars.forEach(function (c) { if (c.count > 0) out[c.id] = c.count; });
    });
    return out;
  }

  function doClear() {
    var snap = nonZero();
    var n = Object.keys(snap).length;
    if (!n) return;
    RS.raid.sections.forEach(function (s) {
      s.chars.forEach(function (c) { c.count = 0; });
    });
    RS.saveRaid();
    RS.renderRaid();
    RS.showToast(n + "件のカウントを0に戻しました", function () {
      // 戻したキャラだけ元のカウントに復元する
      RS.raid.sections.forEach(function (s) {
        s.chars.forEach(function (c) { if (snap[c.id] != null) c.count = snap[c.id]; });
      });
      RS.saveRaid();
      RS.renderRaid();
    }, RS.UNDO_MS);
  }

  RS.requestRaidClear = function () {
    if (!Object.keys(nonZero()).length) {
      RS.showToast("カウントされているキャラはありません", null, 2500);
      return;
    }
    RS.openConfirm({
      title: "レイドのカウントをすべて0に戻しますか?",
      text: "全キャラのカウントを0に戻します。アカウントとキャラは消えません。週課のデータには影響しません。\n実行後、5秒間だけ「元に戻す」で取り消せます。",
      okLabel: "クリア",
      onOk: doClear
    });
  };

  function resetRaid() {
    RS.hideToast();
    RS.raid = RS.defaultRaid();
    RS.raidSelected = {};
    RS.raidBulkAccountId = "";
    $("raidBulkName").value = "";
    growRaidBulk();
    $("raidAccountName").value = "";
    RS.wipeRaid();
    RS.saveRaid();
    RS.renderRaid();
  }

  RS.requestRaidReset = function () {
    RS.openConfirm({
      title: "レイドのデータを初期化しますか?",
      text: "レイドのすべてのデータ(アカウント、キャラクター、カウント、追加したセクション)を削除し、「骸骨王」「ドラゴート」「ソメル・ノチェス」「ケルベロス」だけの初期状態に戻します。週課のデータは消えません。この操作は元に戻せません。必要であれば先にエクスポートしてください。",
      okLabel: "初期化",
      onOk: resetRaid
    });
  };

  /* ================= イベント登録 ================= */
  RS.bindRaid = function () {
    $("raidAddSection").addEventListener("click", addSection);
    $("raidAccountAdd").addEventListener("click", addAccount);
    $("raidBulkAdd").addEventListener("click", bulkAdd);

    $("raidBulkAccount").addEventListener("change", function () {
      RS.raidBulkAccountId = $("raidBulkAccount").value;
      $("raidBulkAccount").classList.toggle("is-empty", !RS.raidBulkAccountId);
    });

    $("raidAccountName").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); addAccount(); }
    });
    $("raidBulkName").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        bulkAdd();
      }
    });
    $("raidBulkName").addEventListener("input", growRaidBulk);

    $("raidExportBtn").addEventListener("click", RS.exportData);
    $("raidImportBtn").addEventListener("click", function () { $("importFile").click(); });
  };
})();