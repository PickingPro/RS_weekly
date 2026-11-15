// ドラッグ&ドロップ並べ替え(週課内のキャラ・週課セクション)
(function () {
  "use strict";

  var RS = window.RS;
  var $ = RS.$;

  RS.secDrag = null;   // 週課ドラッグ中の情報 { sid }

  RS.clearDrop = function () {
    var list = document.querySelectorAll(".drop-before, .drop-after, .drop-end");
    for (var i = 0; i < list.length; i++) {
      list[i].classList.remove("drop-before", "drop-after", "drop-end");
    }
  };

  /* ================= キャラ(同じアカウント内) ================= */
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
    return RS.drag && RS.drag.sid === s.id && RS.drag.aid === a.id;
  }

  RS.bindCharDrag = function (row, handle, s, c, a) {
    // ハンドルを押したときだけカードをドラッグ可能にする
    handle.addEventListener("mousedown", function () { row.draggable = true; });
    handle.addEventListener("mouseup", function () { row.draggable = false; });

    row.addEventListener("dragstart", function (e) {
      RS.drag = { sid: s.id, cid: c.id, aid: a.id };
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", c.id); } catch (err) {}
      try { e.dataTransfer.setDragImage(row, 20, 16); } catch (err) {}
      setTimeout(function () { row.classList.add("dragging"); }, 0);
    });

    row.addEventListener("dragend", function () {
      row.draggable = false;
      row.classList.remove("dragging");
      RS.drag = null;
      RS.clearDrop();
    });

    row.addEventListener("dragover", function (e) {
      if (!canDrop(s, a)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      RS.clearDrop();
      if (RS.drag.cid === c.id) return;
      row.classList.add(isAfter(e, row) ? "drop-after" : "drop-before");
    });

    row.addEventListener("drop", function (e) {
      if (!canDrop(s, a)) return;
      e.preventDefault();
      e.stopPropagation();
      if (RS.drag.cid !== c.id) {
        moveChar(s, RS.drag.cid, c.id, isAfter(e, row), a.id);
        RS.save();
      }
      RS.drag = null;
      RS.clearDrop();
      RS.render();
    });
  };

  RS.bindGridDrop = function (grid, s, a) {
    grid.addEventListener("dragover", function (e) {
      if (!canDrop(s, a)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      RS.clearDrop();
      grid.classList.add("drop-end");
    });
    grid.addEventListener("drop", function (e) {
      if (!canDrop(s, a)) return;
      e.preventDefault();
      moveChar(s, RS.drag.cid, null, false, a.id);
      RS.save();
      RS.drag = null;
      RS.clearDrop();
      RS.render();
    });
  };

  /* ================= 週課セクション ================= */
  // targetId の前後(なければ末尾)へ移動して保存する
  function moveSection(sectionId, targetId, after) {
    var list = RS.state.sections;
    var from = -1, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].id === sectionId) { from = i; break; }
    }
    if (from < 0) return;
    var s = list.splice(from, 1)[0];
    var pos = list.length;
    if (targetId) {
      for (i = 0; i < list.length; i++) {
        if (list[i].id === targetId) { pos = i + (after ? 1 : 0); break; }
      }
    }
    list.splice(pos, 0, s);
    RS.save();
  }

  // 1列表示(900px以下)は上下、2列表示は左右で前後を判定する
  function isAfterSection(e, box) {
    var r = box.getBoundingClientRect();
    if (window.matchMedia("(max-width: 900px)").matches) {
      return e.clientY > r.top + r.height / 2;
    }
    return e.clientX > r.left + r.width / 2;
  }

  RS.bindSectionDrag = function (box, handle, s) {
    // ハンドルを押したときだけ週課をドラッグ可能にする(入力欄の操作を妨げないため)
    handle.addEventListener("mousedown", function () { box.draggable = true; });
    handle.addEventListener("mouseup", function () { box.draggable = false; });

    box.addEventListener("dragstart", function (e) {
      if (e.target !== box) return;   // キャラカードのドラッグは対象外
      RS.secDrag = { sid: s.id };
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", s.id); } catch (err) {}
      try { e.dataTransfer.setDragImage(box, 20, 16); } catch (err) {}
      setTimeout(function () { box.classList.add("dragging"); }, 0);
    });

    box.addEventListener("dragend", function (e) {
      if (e.target !== box) return;
      box.draggable = false;
      box.classList.remove("dragging");
      RS.secDrag = null;
      RS.clearDrop();
    });

    box.addEventListener("dragover", function (e) {
      if (!RS.secDrag) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      RS.clearDrop();
      if (RS.secDrag.sid === s.id) return;
      box.classList.add(isAfterSection(e, box) ? "drop-after" : "drop-before");
    });

    box.addEventListener("drop", function (e) {
      if (!RS.secDrag) return;
      e.preventDefault();
      e.stopPropagation();
      if (RS.secDrag.sid !== s.id) {
        moveSection(RS.secDrag.sid, s.id, isAfterSection(e, box));
      }
      RS.secDrag = null;
      RS.clearDrop();
      RS.render();
    });
  };

  // 週課同士の隙間にドロップしたら、末尾へ移動する(起動時に1回だけ登録)
  RS.bindSectionDrop = function () {
    var root = $("sections");
    root.addEventListener("dragover", function (e) {
      if (!RS.secDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      RS.clearDrop();
    });
    root.addEventListener("drop", function (e) {
      if (!RS.secDrag) return;
      e.preventDefault();
      moveSection(RS.secDrag.sid, null, false);
      RS.secDrag = null;
      RS.clearDrop();
      RS.render();
    });
  };
})();