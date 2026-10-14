/* ============================================================
   存档系统（localStorage）
   规则与状态独立于渲染层，便于替换为服务端存档
   ============================================================ */
window.Store = (function () {
  var KEY = 'poem-ink-save-v1';
  var DEF = { points: 0, unlocked: [], poetId: null, poems: [], runs: 0, best: 0 };

  var state = load();
  var subs = [];

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    var out = {};
    for (var k in DEF) out[k] = DEF[k];
    for (var k2 in s) if (s.hasOwnProperty(k2)) out[k2] = s[k2];
    if (!out.unlocked) out.unlocked = [];
    if (!out.poems) out.poems = [];
    return out;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式忽略 */ }
  }
  function emit() { for (var i = 0; i < subs.length; i++) { try { subs[i](state); } catch (e) {} } }

  return {
    on: function (fn) { subs.push(fn); },
    get: function () { return state; },

    addPoints: function (n) {
      state.points += n; persist(); emit(); return state.points;
    },
    spend: function (n) {
      if (state.points < n) return false;
      state.points -= n; persist(); emit(); return true;
    },
    unlock: function (id) {
      if (state.unlocked.indexOf(id) === -1) { state.unlocked.push(id); persist(); emit(); }
    },
    has: function (id) { return state.unlocked.indexOf(id) !== -1; },

    setPoet: function (id) { state.poetId = id; persist(); emit(); },

    addPoem: function (p) {
      state.poems.unshift(p);
      if (state.poems.length > 30) state.poems = state.poems.slice(0, 30);
      persist(); emit();
    },
    recordRun: function (score) {
      state.runs += 1;
      if (score > state.best) state.best = score;
      persist(); emit();
    },
    reset: function () {
      state = {}; for (var k in DEF) state[k] = DEF[k];
      persist(); emit();
    }
  };
})();
