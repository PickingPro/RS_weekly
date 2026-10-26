// 確認ダイアログ・ヘルプダイアログ・トースト(元に戻す)
(function () {
  "use strict";

  var RS = window.RS;
  var $ = RS.$;

  var modal = $("modal");
  var helpModal = $("helpModal");
  var modalAction = null;
  var toastTimer = null;
  var toastUndoFn = null;

  // いずれかのダイアログが開いている間は、背後の画面のスクロールを止める
  function syncScrollLock() {
    var open = modal.classList.contains("open") || helpModal.classList.contains("open");
    document.documentElement.classList.toggle("modal-open", open);
  }

  /* ---------- 確認ダイアログ ---------- */
  RS.openConfirm = function (o) {
    $("modalTitle").textContent = o.title;
    $("modalText").textContent = o.text;
    $("modalOk").textContent = o.okLabel;
    modalAction = o.onOk;
    modal.classList.add("open");
    syncScrollLock();
    $("modalCancel").focus();   // 誤操作防止のためキャンセルに初期フォーカス
  };

  RS.closeModal = function () {
    modal.classList.remove("open");
    modalAction = null;
    syncScrollLock();
  };

  /* ---------- ヘルプ ---------- */
  RS.openHelp = function () {
    helpModal.classList.add("open");
    syncScrollLock();
    $("helpClose").focus();
  };

  RS.closeHelp = function () {
    helpModal.classList.remove("open");
    syncScrollLock();
  };

  /* ---------- トースト ---------- */
  RS.hideToast = function () {
    clearTimeout(toastTimer);
    toastTimer = null;
    toastUndoFn = null;
    $("toast").classList.remove("show", "run");
  };

  RS.showToast = function (msg, undoFn, ms) {
    RS.hideToast();
    var t = $("toast");
    $("toastMsg").textContent = msg;
    toastUndoFn = undoFn || null;
    $("toastUndo").style.display = undoFn ? "" : "none";
    t.classList.add("show");
    if (undoFn) {
      t.querySelector(".toast-bar").style.animationDuration = ms + "ms";
      void t.offsetWidth;   // アニメーションを最初から再生するため
      t.classList.add("run");
    }
    toastTimer = setTimeout(RS.hideToast, ms);
  };

  /* ---------- イベント登録 ---------- */
  RS.bindDialogs = function () {
    $("modalCancel").addEventListener("click", RS.closeModal);
    $("modalOk").addEventListener("click", function () {
      var f = modalAction;
      RS.closeModal();
      if (f) f();
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) RS.closeModal();
    });

    $("helpBtn").addEventListener("click", RS.openHelp);
    $("helpClose").addEventListener("click", RS.closeHelp);
    helpModal.addEventListener("click", function (e) {
      if (e.target === helpModal) RS.closeHelp();
    });

    $("toastUndo").addEventListener("click", function () {
      var f = toastUndoFn;
      RS.hideToast();
      if (f) f();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (helpModal.classList.contains("open")) RS.closeHelp();
        if (modal.classList.contains("open")) RS.closeModal();
      }
    });
  };
})();