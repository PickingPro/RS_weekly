// 追加メニュー(アカウント追加・キャラ一括追加・追加先の選択)
(function () {
  "use strict";

  var RS = window.RS;
  var $ = RS.$, el = RS.el, uid = RS.uid;

  /* ---------- 追加メニューの開閉 ---------- */
  function growBulk() {
    var t = $("bulkName");
    if (!t.offsetParent) return;   // 折りたたみ中は何もしない
    t.style.height = "auto";
    t.style.height = t.scrollHeight + 2 + "px";
  }
  RS.growBulk = growBulk;

  RS.setAddPanel = function (open) {
    $("addPanel").classList.toggle("collapsed", !open);
    $("addMenuBtn").setAttribute("aria-expanded", open ? "true" : "false");
    $("addMenuBtn").querySelector(".am-arrow").textContent = open ? "▾" : "▸";
    if (open) growBulk();
  };

  function toggleAddPanel() {
    var open = $("addPanel").classList.contains("collapsed");
    RS.setAddPanel(open);
    if (open) {
      var target = RS.state.accounts.length ? $("bulkName") : $("accountName");
      target.focus();
    }
  }

  /* ---------- 追加先アカウントの選択 ---------- */
  function fillAccountSelect(sel, currentId) {
    sel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = RS.state.accounts.length ? "アカウントを選択してください" : "アカウントを追加してください";
    sel.appendChild(ph);
    RS.state.accounts.forEach(function (a) {
      var o = document.createElement("option");
      o.value = a.id;
      o.textContent = a.name || "(無題)";
      sel.appendChild(o);
    });
    sel.value = RS.findAccount(currentId) ? currentId : "";
    sel.classList.toggle("is-empty", !sel.value);
  }

  RS.renderAccountSelects = function () {
    if (!RS.findAccount(RS.bulkAccountId)) RS.bulkAccountId = "";
    if (!RS.findAccount(RS.suppAccountId)) RS.suppAccountId = "";
    fillAccountSelect($("bulkAccount"), RS.bulkAccountId);
    fillAccountSelect($("suppAccount"), RS.suppAccountId);
  };

  // 一括追加の対象週課チェック
  RS.renderTargets = function () {
    var box = $("bulkTargets");
    box.innerHTML = "";
    RS.state.sections.forEach(function (s) {
      var label = el("label", "target");
      label.dataset.target = s.id;
      label.style.setProperty("--c", RS.COLORS[s.color % RS.COLORS.length]);

      var cb = el("input");
      cb.type = "checkbox";
      cb.checked = RS.selected[s.id] !== false;
      cb.addEventListener("change", function () { RS.selected[s.id] = cb.checked; });

      var txt = el("span", "target-text", s.name || "(無題)");
      label.appendChild(cb);
      label.appendChild(txt);
      box.appendChild(label);
    });
  };

  // アカウント名の変更を画面全体に反映(入力中の欄は再描画しない)
  RS.syncAccountNames = function (a, activeInput) {
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
    list = document.querySelectorAll(".pool-chip");
    for (i = 0; i < list.length; i++) {
      if (list[i].dataset.account === a.id) {
        list[i].textContent = label + " / " + list[i].dataset.name + "  ＋";
      }
    }
  };

  /* ---------- アカウント追加 ---------- */
  // アカウントの登録のみ(週課側には追加しない)
  function addAccount() {
    var input = $("accountName");
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    var dup = RS.state.accounts.some(function (a) { return a.name === name; });
    if (dup) { alert("同名のアカウントが既に存在します。"); return; }
    var a = { id: uid(), name: name };
    RS.state.accounts.push(a);
    RS.bulkAccountId = a.id;   // 追加したアカウントをキャラ追加先に選択
    input.value = "";
    RS.save();
    RS.renderAccountSelects();
    input.focus();
  }

  /* ---------- キャラ一括追加 ---------- */
  // 入力文字列を、空白(半角・全角・タブ・改行)とカンマで区切ってキャラ名の配列にする
  function splitNames(text) {
    var seen = {};
    var out = [];
    String(text).split(/[\s,，、]+/).forEach(function (n) {
      if (n && !seen[n]) { seen[n] = true; out.push(n); }
    });
    return out;
  }

  // チェック済みの週課すべてに、選択中アカウントのキャラを(複数まとめて)追加
  function bulkAdd() {
    if (!RS.findAccount(RS.bulkAccountId)) { alert("アカウントを選択してください"); return; }
    var input = $("bulkName");
    var names = splitNames(input.value);
    if (!names.length) { input.focus(); return; }

    var targets = RS.state.sections.filter(function (s) { return RS.selected[s.id] !== false; });
    if (!targets.length) { alert("追加先の週課を選択してください。"); return; }

    var accountId = RS.bulkAccountId;
    var leader = $("bulkLeader").checked;
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
        s.chars.push({
          id: uid(),
          name: name,
          checked: false,
          leader: leader,
          accountId: accountId,
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
    RS.save();
    RS.render();
    input.focus();

    if (skippedList.length) {
      alert("次のキャラは、登録済みの週課ではスキップしました。\n" + skippedList.join("、"));
    }
  }

  /* ---------- イベント登録 ---------- */
  RS.bindAddBar = function () {
    $("addMenuBtn").addEventListener("click", toggleAddPanel);
    $("bulkAdd").addEventListener("click", bulkAdd);
    $("accountAdd").addEventListener("click", addAccount);

    $("bulkAccount").addEventListener("change", function () {
      RS.bulkAccountId = $("bulkAccount").value;
      $("bulkAccount").classList.toggle("is-empty", !RS.bulkAccountId);
    });

    $("accountName").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); addAccount(); }
    });

    // キャラ一括追加: Enterで追加、Shift+Enterで改行。入力に応じて高さを自動調整
    $("bulkName").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        bulkAdd();
      }
    });
    $("bulkName").addEventListener("input", growBulk);
  };
})();