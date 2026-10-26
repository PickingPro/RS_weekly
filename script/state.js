// データの整形・検索・整合性処理
(function () {
  "use strict";

  var RS = window.RS;
  var uid = RS.uid, toHalf = RS.toHalf, noteKey = RS.noteKey;

  // 保存データ・インポートデータを安全な形に整える
  RS.normalize = function (d) {
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
          pick: typeof s.pick === "string" ? s.pick : "",            // ヒペリオン「とどめ」
          pickTame: typeof s.pickTame === "string" ? s.pickTame : "", // ヒペリオン「テイマ」
          ticket: toHalf(s.ticket == null ? "" : s.ticket).replace(/\D/g, "").slice(0, 3), // タビアクート「チケット」
          chars: []
        };
        var isReq = RS.REQUIRED.some(function (r) { return r.key === s.key; });
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

    RS.REQUIRED.forEach(function (r, i) {
      var f = null;
      d.sections.forEach(function (s) { if (s.key === r.key) f = s; });
      if (!f) {
        f = { id: uid(), key: r.key, name: r.name, color: r.color, pick: "", pickTame: "", ticket: "", chars: [] };
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

    // 補足情報欄に表示する週課キャラ(アカウントID → キャラ名の配列)
    var secValid = {};
    d.sections.forEach(function (s) {
      s.chars.forEach(function (c) { secValid[noteKey(c.accountId, c.name)] = true; });
    });
    var sc = {};
    if (d.suppShown && typeof d.suppShown === "object" && !Array.isArray(d.suppShown)) {
      Object.keys(d.suppShown).forEach(function (k) {
        if (!ids[k] || !Array.isArray(d.suppShown[k])) return;
        var seen = {};
        var list = d.suppShown[k].filter(function (n) {
          if (typeof n !== "string" || !n || seen[n] || !secValid[noteKey(k, n)]) return false;
          seen[n] = true;
          return true;
        });
        if (list.length) sc[k] = list;
      });
    } else {
      // 旧形式のデータ: 「非表示」にしていたキャラ以外は、これまでどおり表示扱いで引き継ぐ
      var oldHidden = (d.suppHidden && typeof d.suppHidden === "object") ? d.suppHidden : {};
      d.sections.forEach(function (s) {
        s.chars.forEach(function (c) {
          if (!c.name) return;
          var hidden = Array.isArray(oldHidden[c.accountId]) && oldHidden[c.accountId].indexOf(c.name) >= 0;
          if (hidden) return;
          var list = sc[c.accountId] || (sc[c.accountId] = []);
          if (list.indexOf(c.name) < 0) list.push(c.name);
        });
      });
    }
    d.suppShown = sc;
    delete d.suppHidden;
    return d;
  };

  RS.defaultState = function () {
    return RS.normalize({ accounts: [], sections: [], extra: [], notes: {}, suppOrder: {}, suppShown: {} });
  };

  RS.nextColorIndex = function () {
    var used = RS.state.sections.map(function (s) { return s.color; });
    for (var i = 0; i < RS.COLORS.length; i++) {
      if (used.indexOf(i) === -1) return i;
    }
    return RS.state.sections.length % RS.COLORS.length;
  };

  RS.find = function (id) {
    var list = RS.state.sections;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  };

  RS.findAccount = function (id) {
    if (!id) return null;
    var list = RS.state.accounts;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  };

  RS.sectionHasName = function (accountId, name) {
    return RS.state.sections.some(function (s) {
      return s.chars.some(function (c) { return c.accountId === accountId && c.name === name; });
    });
  };

  RS.extraHasName = function (accountId, name) {
    return RS.state.extra.some(function (x) { return x.accountId === accountId && x.name === name; });
  };

  RS.nameExists = function (accountId, name) {
    return RS.sectionHasName(accountId, name) || RS.extraHasName(accountId, name);
  };

  RS.isSuppShown = function (accountId, name) {
    var list = RS.state.suppShown[accountId];
    return !!list && list.indexOf(name) >= 0;
  };

  // どこにも存在しないキャラの補足情報(月・メモ)と表示の記録を削除する
  RS.pruneNotes = function () {
    var st = RS.state;
    var secValid = {};
    var valid = {};
    st.sections.forEach(function (s) {
      s.chars.forEach(function (c) {
        secValid[noteKey(c.accountId, c.name)] = true;
        valid[noteKey(c.accountId, c.name)] = true;
      });
    });
    st.extra.forEach(function (x) { valid[noteKey(x.accountId, x.name)] = true; });
    Object.keys(st.notes).forEach(function (k) {
      if (!valid[k]) delete st.notes[k];
    });
    Object.keys(st.suppShown).forEach(function (aid) {
      var list = st.suppShown[aid].filter(function (n) { return secValid[noteKey(aid, n)]; });
      if (list.length) st.suppShown[aid] = list;
      else delete st.suppShown[aid];
    });
  };

  RS.setNote = function (key, field, val) {
    var notes = RS.state.notes;
    var n = notes[key] || (notes[key] = { month: "", memo: "" });
    n[field] = val;
    if (!n.month && !n.memo) delete notes[key];
    RS.save();
  };

  // 選択中のキャラが存在しなくなっていたら、その側を未選択に戻す
  RS.sanitizePicks = function () {
    var changed = false;
    RS.state.sections.forEach(function (s) {
      ["pick", "pickTame"].forEach(function (f) {
        if (s[f] && !s.chars.some(function (c) { return c.id === s[f]; })) {
          s[f] = "";
          changed = true;
        }
      });
    });
    if (changed) RS.save();
  };
})();