(function () {
  "use strict";

  var STORAGE_KEY = "RS_weekly_v1";
  // セクションごとに枠線の色を分けるためのパレット
  var COLORS = ["#e0463c", "#3fa9f5", "#4ccf8a", "#f5b73f", "#b074f5", "#f56fa8", "#3fd6d0", "#f58a3f"];

  // 一括追加の対象選択状態(セクションID → true/false)。未設定は選択済み扱い
  var selected = {};

  var state = load();

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function defaultState() {
    return {
      sections: [
        { id: uid(), name: "ヒペリオン", color: 0, chars: [] },
        { id: uid(), name: "タビアクート", color: 1, chars: [] }
      ]
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.sections)) return d;
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

  function addChar(sectionId) {
    var s = find(sectionId);
    if (!s) return;
    s.chars.push({ id: uid(), name: "", checked: false });
    save();
    render();
    var inputs = document.querySelectorAll('[data-section="' + sectionId + '"] .char-name');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  // 画面最上部の入力欄から、チェック済みの週課すべてにキャラ名を追加
  function bulkAdd() {
    var input = document.getElementById("bulkName");
    var name = input.value.trim();
    if (!name) { input.focus(); return; }

    var added = false;
    state.sections.forEach(function (s) {
      if (selected[s.id] !== false) {
        s.chars.push({ id: uid(), name: name, checked: false });
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
    document.getElementById("bulkName").value = "";
    save();
    render();
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function updateProgress(section, node) {
    var done = section.chars.filter(function (c) { return c.checked; }).length;
    node.textContent = done + " / " + section.chars.length;
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

  /* ---------- 一括追加バーの対象チェックボックス ---------- */
  function renderTargets() {
    var box = document.getElementById("bulkTargets");
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

  function render() {
    var root = document.getElementById("sections");
    root.innerHTML = "";

    state.sections.forEach(function (s) {
      var box = el("section", "section");
      box.dataset.section = s.id;
      box.style.setProperty("--c", COLORS[s.color % COLORS.length]);

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
      updateProgress(s, progress);

      var addBtn = el("button", "btn-add-char", "＋ キャラクター追加");
      addBtn.type = "button";
      addBtn.addEventListener("click", function () { addChar(s.id); });

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
      head.appendChild(addBtn);
      head.appendChild(delSec);
      box.appendChild(head);

      var grid = el("div", "chars");
      s.chars.forEach(function (c) {
        var row = el("div", "char" + (c.checked ? " done" : ""));

        var cb = el("input");
        cb.type = "checkbox";
        cb.checked = !!c.checked;
        cb.addEventListener("change", function () {
          c.checked = cb.checked;
          row.classList.toggle("done", c.checked);
          updateProgress(s, progress);
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

        var del = el("button", "btn-del", "✕");
        del.type = "button";
        del.title = "このキャラクターを削除";
        del.addEventListener("click", function () {
          s.chars = s.chars.filter(function (x) { return x.id !== c.id; });
          save();
          render();
        });

        row.appendChild(cb);
        row.appendChild(nm);
        row.appendChild(del);
        grid.appendChild(row);
      });
      box.appendChild(grid);

      root.appendChild(box);
    });

    renderTargets();
    fitAll();   // DOMに追加された後でサイズを計算
  }

  /* ---------- 初期化の確認ダイアログ ---------- */
  var modal = document.getElementById("modal");

  function openModal() {
    modal.classList.add("open");
    document.getElementById("modalCancel").focus();
  }
  function closeModal() {
    modal.classList.remove("open");
  }

  document.getElementById("resetFab").addEventListener("click", openModal);
  document.getElementById("modalCancel").addEventListener("click", closeModal);
  document.getElementById("modalOk").addEventListener("click", function () {
    closeModal();
    resetAll();
  });
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
  });

  document.getElementById("addSection").addEventListener("click", addSection);
  document.getElementById("clearBtn").addEventListener("click", clearAll);
  document.getElementById("bulkAdd").addEventListener("click", bulkAdd);
  document.getElementById("bulkName").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); bulkAdd(); }
  });

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitAll, 60);
  });

  render();
})();