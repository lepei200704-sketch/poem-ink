/* ============================================================
   赋诗引擎：按诗魂风格 + 用户输入，生成新诗
   规则化生成（模板 + 意象词库 + 新韵韵脚）
   如需更强表现力，可把 compose() 换成一次大模型 API 调用
   ============================================================ */
window.PoemGen = (function () {
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function flattenEnds(poet) {
    var out = [];
    for (var k in poet.lexicon.ends) out = out.concat(poet.lexicon.ends[k]);
    return out;
  }
  // 收集所有诗魂的已知词，用于从用户文本中提取意象
  var KNOWN = (function () {
    var set = {};
    (window.POETS || []).forEach(function (p) {
      p.lexicon.open.concat(p.lexicon.collo, p.lexicon.act, flattenEnds(p)).forEach(function (w) { set[w] = 1; });
    });
    return set;
  })();

  var PUNCT = /[\s，。！？、；：,.!?;:…—“”‘’"'（）()《》〈〉·\-]/g;

  // 从用户文本中提取意象词（优先整词命中，其次单字映射）
  function keywords(text) {
    var out = [];
    var t = (text || '').replace(PUNCT, '');
    if (!t) return out;
    for (var len = 4; len >= 2; len--) {
      for (var i = 0; i + len <= t.length; i++) {
        var w = t.substr(i, len);
        if (!KNOWN[w]) continue;
        if (out.indexOf(w) !== -1) continue;
        // 避免与已收录词重叠
        var overlap = out.some(function (o) { return o.indexOf(w) !== -1 || w.indexOf(o) !== -1; });
        if (!overlap) out.push(w);
      }
    }
    if (out.length) return out.slice(0, 3);

    // 单字 → 意象词
    var seen = {};
    for (var j = 0; j < t.length; j++) {
      var ch = t.charAt(j);
      var mapped = window.IMG_MAP && window.IMG_MAP[ch];
      if (mapped) {
        var w2 = pick(mapped);
        if (!seen[w2]) { seen[w2] = 1; out.push(w2); }
      }
    }
    return out.slice(0, 3);
  }

  // 取一个用于题名的核心词
  function coreWord(text, kws) {
    if (kws && kws.length) return kws[0];
    var t = (text || '').replace(PUNCT, '');
    if (t.length >= 2) return t.substr(0, 2);
    return '';
  }

  var TITLE_T = {
    libai: ['{w}行', '{w}吟', '拟{w}歌', '{w}引'],
    dufu: ['{w}叹', '{w}书事', '悲{w}行', '{w}杂感'],
    wangwei: ['{w}即景', '辋川{w}', '{w}闲居', '{w}小记'],
    liqingzhao: ['{w}词', '{w}令', '{w}寄', '{w}忆'],
    sushi: ['{w}漫笔', '{w}偶书', '{w}风雨', '{w}一首']
  };

  // 主入口
  function compose(poet, text, form) {
    var is7 = form === '七言绝句';
    var kws = keywords(text);
    var keys = Object.keys(poet.lexicon.ends);
    var rhymeKey = pick(keys);
    var rhymeEnds = poet.lexicon.ends[rhymeKey];
    var otherEnds = [];
    for (var k in poet.lexicon.ends) if (k !== rhymeKey) otherEnds = otherEnds.concat(poet.lexicon.ends[k]);
    if (!otherEnds.length) otherEnds = rhymeEnds;

    var lines = [];
    for (var i = 0; i < 4; i++) {
      var needRhyme = (i === 1 || i === 3) || (i === 0 && Math.random() < 0.55);
      var end = pick(needRhyme ? rhymeEnds : otherEnds);

      var useKw = kws.length > 0 && i < 2;
      var kw = useKw ? pick(kws) : '';

      var head;
      if (is7) {
        head = useKw ? (kw.length >= 3 ? kw.substr(0, 2) : kw) + pick(poet.lexicon.act)   // 2 + 2
                     : pick(poet.lexicon.collo);                                          // 4
      } else {
        head = useKw ? (kw.length >= 3 ? kw.substr(0, 2) : kw)                             // 2
                     : pick(poet.lexicon.open);                                           // 2
      }
      // 长度守卫：确保每行字数正确
      var need = (is7 ? 7 : 5) - end.length;
      while (head.length < need) head += pick(poet.lexicon.open).charAt(0);
      if (head.length > need) head = head.substr(0, need);

      lines.push(head + end);
    }

    var w = coreWord(text, kws);
    var title = w ? pick(TITLE_T[poet.id] || ['{w}']).replace('{w}', w)
                  : pick(poet.lexicon.open) + (is7 ? '绝句' : '小诗');

    var preface;
    var clean = (text || '').replace(/\s+/g, ' ').trim();
    if (clean) preface = '「' + clean.substr(0, 40) + '」——' + poet.name + '以' + poet.styleName + '和之';
    else preface = poet.name + '闲坐无事，偶得' + (is7 ? '七言' : '五言') + '一首';

    // 韵脚 + 意象统计，用于展示“创作参数”
    var rhymeChars = rhymeEnds.map(function (e) { return e.charAt(e.length - 1); });
    var meta = {
      rhyme: '新韵 · ' + rhymeKey + '韵（韵脚：' + Array.from(new Set(rhymeChars)).join('/') + '）',
      imgs: kws.length ? kws.join(' · ') : poet.lexicon.open.slice(0, 3).join(' · '),
      extra: poet.relics.slice(0, 2).join(' · ')
    };

    var comment = pick(poet.replies);
    if (kws.length) comment = '「' + kws[0] + '」入得好。' + comment;

    return {
      title: title,
      author: poet.name,
      dynasty: poet.dynasty,
      styleName: poet.styleName,
      form: form,
      lines: lines,
      preface: preface,
      comment: comment,
      meta: meta,
      poetId: poet.id,
      seed: clean
    };
  }

  return { compose: compose, keywords: keywords };
})();
