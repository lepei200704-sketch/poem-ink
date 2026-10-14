/* ============================================================
   闯关题库：由诗词库实时生成，无需人工出题
   题型：诗句接续 / 名句识人 / 补字填空
   ============================================================ */
window.QuizBank = (function () {
  var P = window.POEMS;

  function rawLen(s) { return s.replace(/[，。！？、；：,.!?;:…—]/g, '').length; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function poemPool(cat) {
    if (!cat || cat === 'all') return P.slice();
    var f = P.filter(function (p) { return p.tags.indexOf(cat) !== -1; });
    return f.length >= 6 ? f : P.slice();
  }
  function others(src) { return P.filter(function (p) { return p !== src; }); }

  /* 诗句接续：给出上句，选出下句 */
  function qNext(poem) {
    if (!poem.l || poem.l.length < 2) return null;
    var q = poem.l[0];
    if (rawLen(q) < 3) return null;
    var ans = poem.l[1];
    var len = rawLen(ans);
    var cands = [];
    others(poem).forEach(function (p) {
      for (var i = 1; i < p.l.length; i++) {
        if (rawLen(p.l[i]) === len && p.l[i] !== ans) cands.push(p.l[i]);
      }
    });
    if (cands.length < 3) {
      others(poem).forEach(function (p) {
        for (var i = 0; i < p.l.length; i++) if (p.l[i] !== ans && cands.indexOf(p.l[i]) === -1) cands.push(p.l[i]);
      });
    }
    cands = shuffle(cands).slice(0, 3);
    if (cands.length < 3) return null;
    var opts = shuffle([ans].concat(cands));
    return {
      typeName: '诗句接续',
      prompt: q + '，______',
      options: opts,
      answer: opts.indexOf(ans),
      explain: function (ok) {
        return (ok ? '正是。' : '应是——') + '「<b>' + ans + '</b>」<br>出自 ' +
          (poem.d || '') + '·' + poem.a + '《' + poem.t + '》<br>' + poem.l.join('，') + '。';
      }
    };
  }

  /* 名句识人：给出一句，选出作者 */
  function qAuthor(poem) {
    var line = poem.l[Math.floor(Math.random() * Math.min(2, poem.l.length))] || poem.l[0];
    if (rawLen(line) < 4) line = poem.l[0];
    var authors = [];
    P.forEach(function (p) { if (p.a !== poem.a && authors.indexOf(p.a) === -1) authors.push(p.a); });
    if (authors.length < 3) return null;
    var opts = shuffle([poem.a].concat(shuffle(authors).slice(0, 3)));
    return {
      typeName: '名句识人',
      prompt: line + '。',
      options: opts,
      answer: opts.indexOf(poem.a),
      explain: function (ok) {
        return (ok ? '不错。' : '其实是——') + '「<b>' + line + '</b>」<br>出自 ' +
          (poem.d || '') + '·' + poem.a + '《' + poem.t + '》';
      }
    };
  }

  /* 补字填空：挖去名句中的一个字 */
  function qBlank(poem) {
    var cands = poem.l.filter(function (s) { return rawLen(s) >= 5; });
    if (!cands.length) return null;
    var line = pick(cands);
    var plain = line;
    var idx = Math.floor(plain.length / 2);
    var at = plain.charAt(idx);
    // 避免挖到标点
    var guard = 0;
    while (/[，。！？、；：,.!?;:]/.test(at) && guard++ < 8) { idx = (idx + 1) % plain.length; at = plain.charAt(idx); }
    if (at === '，' || at === '。' || at === '') return null;

    var shown = plain.substr(0, idx) + '＿' + plain.substr(idx + 1);
    var pool = {};
    P.forEach(function (p) {
      p.l.forEach(function (s) {
        var t = s.replace(/[，。！？、；：,.!?;:…—]/g, '');
        for (var i = 0; i < t.length; i++) pool[t.charAt(i)] = 1;
      });
    });
    var keys = Object.keys(pool).filter(function (c) { return c !== at; });
    var opts = shuffle([at].concat(shuffle(keys).slice(0, 3)));
    return {
      typeName: '补字填空',
      prompt: shown,
      options: opts,
      answer: opts.indexOf(at),
      explain: function (ok) {
        return (ok ? '一字不错。' : '这一字是——') + '「<b>' + at + '</b>」<br>原句：' +
          (poem.d || '') + '·' + poem.a + '《' + poem.t + '》<br>' + poem.l.join('，') + '。';
      }
    };
  }

  var MAKERS = [qNext, qAuthor, qBlank];

  function build(cat, n) {
    n = n || 6;
    var pool = shuffle(poemPool(cat));
    var qs = [];
    var tries = 0;
    while (qs.length < n && tries < 300) {
      tries++;
      var poem = pool[qs.length % pool.length];
      var mk = MAKERS[qs.length % MAKERS.length];
      var q = null;
      try { q = mk(poem); } catch (e) { q = null; }
      if (!q && mk !== qAuthor) { try { q = qAuthor(poem); } catch (e) { q = null; } }
      if (q) qs.push(q);
    }
    return qs;
  }

  return { build: build };
})();
