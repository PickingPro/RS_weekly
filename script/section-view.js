// 週課セクション(見出し・アカウントブロック・キャラカード)の描画
(function () {
  "use strict";

  var RS = window.RS;
  var $ = RS.$, el = RS.el, toHalf = RS.toHalf;

  /* ---------- ヒペリオンのキャラ選択プルダウン(テイマ・とどめ) ---------- */
  function fillPick(sel, s, field) {
    sel.innerHTML = "";
    var none = document.createElement("option");
    none.value = "";
    none.textContent = "未選択";
    sel.appendChild(none);
    RS.state.accounts.forEach(function (a) {
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
    sel.value = s[field] || "";
  }

  /* ---------- 週課見出し ---------- */
  function buildSectionHead(s, req) {
    var head = el("div", "section-head");

    // タイトルの左: 未完了 / 完了(refreshProgressで更新)
    head.appendChild(el("span", "section-status", "未完了"));

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
        RS.save();
      });
    }
    head.appendChild(name);

    // ヒペリオン: 「テイマ」「とどめ」のキャラ選択(クリアしても保持)
    if (s.key === "hyperion") {
      var group = el("div", "pick-group");
      [["テイマ", "pickTame"], ["とどめ", "pick"]].forEach(function (def) {
        var item = el("label", "pick-item");
        item.appendChild(el("span", "pick-label", def[0]));
        var pick = el("select", "section-pick");
        pick.title = def[0] + "のキャラ(クリアしても保持されます)";
        fillPick(pick, s, def[1]);
        pick.addEventListener("change", function () {
          s[def[1]] = pick.value;
          RS.save();
        });
        item.appendChild(pick);
        group.appendChild(item);
      });
      head.appendChild(group);
    }

    // タビアクート: チケット入力(3桁まで)と、全アカウントの数字の合計
    if (s.key === "tabiakuto") {
      var tw = el("label", "ticket-wrap");
      tw.appendChild(document.createTextNode("チケット："));
      var tk = el("input", "ticket-input");
      tk.type = "text";
      tk.setAttribute("inputmode", "numeric");
      tk.maxLength = 3;
      tk.autocomplete = "off";
      tk.placeholder = "000";
      tk.title = "チケット(3桁まで・クリアしても保持されます)";
      tk.value = s.ticket || "";
      var applyTicket = function () {
        var v = toHalf(tk.value).replace(/\D/g, "").slice(0, 3);
        if (v !== tk.value) tk.value = v;
        s.ticket = v;
        RS.save();
      };
      tk.addEventListener("input", function (e) {
        if (e.isComposing) return;
        applyTicket();
      });
      tk.addEventListener("compositionend", applyTicket);
      tw.appendChild(tk);
      head.appendChild(tw);

      var tsum = el("span", "tabi-sum", "タビかけ：" + RS.tabiSum(s));
      tsum.dataset.section = s.id;
      tsum.title = "タビアクートの数字(全アカウント)の合計";
      head.appendChild(tsum);
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
        RS.state.sections = RS.state.sections.filter(function (x) { return x.id !== s.id; });
        delete RS.selected[s.id];
        RS.pruneNotes();
        RS.save();
        RS.render();
      });
      head.appendChild(delSec);
    }
    return head;
  }

  /* ---------- キャラカード ---------- */
  function buildCharCard(s, a, c, isTabi, grid) {
    var row = el("div", "char" + (c.checked ? " done" : "") + (c.leader ? " leader" : ""));

    var handle = el("span", "drag-handle");
    handle.title = "ドラッグして並べ替え";

    var cb = el("input");
    cb.type = "checkbox";
    cb.checked = !!c.checked;
    cb.addEventListener("change", function () {
      c.checked = cb.checked;
      row.classList.toggle("done", c.checked);
      RS.refreshProgress();
      RS.save();
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
      RS.refreshProgress();   // 引率/寄生の件数を更新
      RS.save();
    });

    var del = el("button", "btn-char-del", "✕");
    del.type = "button";
    del.title = "このキャラクターを削除";
    del.addEventListener("click", function () {
      s.chars = s.chars.filter(function (x) { return x.id !== c.id; });
      RS.pruneNotes();
      RS.save();
      RS.render();
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

    RS.bindCharDrag(row, handle, s, c, a);

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
        RS.refreshTabiSum();
        RS.save();
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
  }

  /* ---------- アカウントブロック ---------- */
  function buildAccountBlock(s, a, list) {
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
      RS.syncAccountNames(a, an);
      RS.save();
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
      RS.pruneNotes();
      RS.save();
      RS.render();
    });

    ah.appendChild(an);
    ah.appendChild(el("span", "done-badge", "完了"));
    ah.appendChild(ap);
    ah.appendChild(delAcc);
    acc.appendChild(ah);

    // キャラクター(1行5列。タビアクートのみ1行4列。増えた分だけ自動で高さが伸びる)
    var isTabi = s.key === "tabiakuto";
    var grid = el("div", "chars" + (isTabi ? " cols4" : ""));
    RS.bindGridDrop(grid, s, a);
    list.forEach(function (c) { buildCharCard(s, a, c, isTabi, grid); });

    acc.appendChild(grid);
    return acc;
  }

  /* ---------- 週課セクション全体 ---------- */
  RS.renderSections = function () {
    var root = $("sections");
    root.innerHTML = "";

    RS.state.sections.forEach(function (s) {
      var req = !!s.key;
      var box = el("section", "section");
      box.dataset.section = s.id;
      box.style.setProperty("--c", RS.COLORS[s.color % RS.COLORS.length]);

      box.appendChild(buildSectionHead(s, req));

      if (!s.chars.length) {
        box.appendChild(el("p", "empty-hint", "上部の「追加メニュー」からキャラクターを追加できます"));
      }

      // アカウントごとのサブセクション(キャラが存在するアカウントのみ表示)
      RS.state.accounts.forEach(function (a) {
        var list = s.chars.filter(function (c) { return c.accountId === a.id; });
        if (!list.length) return;
        box.appendChild(buildAccountBlock(s, a, list));
      });

      root.appendChild(box);
    });
  };
})();