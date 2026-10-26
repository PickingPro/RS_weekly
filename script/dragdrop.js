// 週課内(同じアカウント内)のキャラのドラッグ&ドロップ並べ替え
(function () {
  "use strict";

  var RS = window.RS;

  RS.clearDrop = function () {
    var list = document.querySelectorAll(".drop-before, .drop-after, .drop-end");
    for (var i = 0; i < list.length; i++) {
      list[i].classList.remove("drop-before", "drop-after", "drop-end");
    }
  };

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
})();