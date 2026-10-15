/* ============================================================
   HUD / 交互层（DOM 呈现，与游戏场景解耦）
   ============================================================ */
window.HUD = (function () {
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function poetById(id) {
    var r = null;
    (window.POETS || []).forEach(function (p) { if (p.id === id) r = p; });
    return r;
  }
  function badgeById(id) {
    var r = null;
    (window.BADGES || []).forEach(function (b) { if (b.id === id || b.poetId === id) r = b; });
    return r;
  }

  var S = { tab: 'poet', form: '七言绝句', cat: null, quiz: null, lastPoem: null, timer: null };

  /* ---------------- 提示条 ---------------- */
  function toast(msg, kind) {
    var wrap = $('#toast-wrap');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.innerHTML = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 340);
    }, 2200);
  }

  /* ---------------- 顶部状态 ---------------- */
  function syncTop() {
    var st = window.Store.get();
    var chip = $('#chip-points');
    if (chip && chip.textContent !== String(st.points)) chip.textContent = st.points;
    var cp = $('#chip-poet');
    var p = poetById(st.poetId);
    if (cp) cp.innerHTML = '<span class="chip-k">诗魂</span><b>' + (p ? esc(p.name) + ' · ' + esc(p.styleName) : '未择') + '</b>';
  }
  function bumpPoints() {
    var wrap = $('#chip-points');
    if (!wrap) return;
    var box = wrap.parentNode;
    box.classList.add('bump');
    var target = window.Store.get().points;
    var from = parseInt(wrap.textContent || '0', 10) || 0;
    var t0 = Date.now();
    (function step() {
      var k = Math.min(1, (Date.now() - t0) / 520);
      var v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      wrap.textContent = v;
      if (k < 1) setTimeout(step, 24); else wrap.textContent = target;
    })();
    setTimeout(function () { box.classList.remove('bump'); }, 420);
  }

  /* ---------------- 标签页 ---------------- */
  function switchTab(tab) {
    S.tab = tab;
    $$('#tabs button').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-tab') === tab); });
    $$('.panel').forEach(function (p) { p.classList.toggle('is-active', p.id === 'panel-' + tab); });
    if (tab === 'badge') renderBadges();
    if (tab === 'compose') renderCompose();
    if (tab === 'quiz' && !$('#quiz-stage').hidden) endQuiz();
  }

  /* ============================================================
     1. 择诗魂
     ============================================================ */
  /* 五友雅集图（单幅统一画面）：每个人物在画中的点击热区（百分比） */
  var FIG_ZONES = {
    dufu:       { x: '12%',   y: '29%', w: '13.5%', h: '62%', z: 2 }, /* 杜甫 · 松下持卷吟咏 */
    libai:      { x: '25.5%', y: '48%', w: '17%',   h: '43%', z: 2 }, /* 李白 · 草地举杯大笑 */
    sushi:      { x: '40.5%', y: '41%', w: '15%',   h: '46%', z: 3 }, /* 苏轼 · 举壶斟酒 */
    liqingzhao: { x: '54%',   y: '37%', w: '17%',   h: '36%', z: 3 }, /* 李清照 · 石案题诗 */
    wangwei:    { x: '70%',   y: '44%', w: '21%',   h: '39%', z: 2 }  /* 王维 · 荷畔抚琴 */
  };

  function renderPoets() {
    var grid = $('#poet-grid');
    if (!grid) return;
    var chosen = window.Store.get().poetId;
    grid.innerHTML = '';
    (window.POETS || []).forEach(function (p) {
      var L = FIG_ZONES[p.id] || { x: '0%', y: '0%', w: '20%', h: '40%', z: 1 };
      var fig = document.createElement('div');
      fig.className = 'figure' + (chosen === p.id ? ' sel' : '');
      fig.setAttribute('data-id', p.id);
      fig.setAttribute('style', '--fx:' + L.x + ';--fy:' + L.y + ';--fw:' + L.w + ';--fh:' + L.h + ';--fz:' + L.z);
      fig.innerHTML = '<span class="f-tag">' + esc(p.name) + ' · ' + esc(p.styleName) + '</span>';
      fig.addEventListener('click', function () { selectPoet(p.id); });
      grid.appendChild(fig);
    });
  }

  function selectPoet(id) {
    window.Store.setPoet(id);
    if (window.Music) window.Music.click();
    $$('.figure').forEach(function (c) { c.classList.toggle('sel', c.getAttribute('data-id') === id); });
    renderSheet();
    var ps = $('#poet-sheet'); if (ps) ps.classList.add('open');
    renderCompose();
    syncTop();
    toast('诗魂已择：<b>' + esc(poetById(id).name) + '</b> · ' + esc(poetById(id).styleName), 'good');
  }

  function renderSheet() {
    var box = $('#poet-sheet');
    if (!box) return;
    var p = poetById(window.Store.get().poetId);
    if (!p) {
      box.classList.remove('open');
      box.innerHTML = '<div class="empty">尚未择定诗魂。点击庭院中的人物，他将成为你的风格导师。</div>';
      return;
    }
    var greet = p.greetings[Math.floor(Math.random() * p.greetings.length)];
    box.innerHTML =
      '<button class="sheet-close" id="sheet-close" title="收起">×</button>' +
      '<div class="sheet-top"><strong>' + esc(p.name) + '</strong>' +
      '<span class="style">' + esc(p.styleName) + ' · ' + p.styleTags.map(esc).join('／') + '</span>' +
      '<span class="style">' + esc([p.zi ? '字' + p.zi : '', p.hao ? '号' + p.hao : ''].filter(Boolean).join(' · ')) + '</span></div>' +
      '<div class="bio">' + esc(p.bio) + '</div>' +
      '<div class="heritage"><b>' + esc(p.heritage.craft) + '</b><br>' +
        '取用元素：' + esc(p.heritage.element) + '<br>' + esc(p.heritage.desc) + '</div>' +
      '<div class="greet">' + esc(greet) + '</div>' +
      '<div class="srow">' +
        '<button class="primary-btn" id="sheet-compose">随他赋诗</button>' +
        '<button class="ghost-btn" id="sheet-badge">观其徽章</button>' +
      '</div>';

    $('#sheet-close').addEventListener('click', function () {
      if (window.Music) window.Music.click();
      box.classList.remove('open');
    });
    $('#sheet-compose').addEventListener('click', function () {
      if (window.Music) window.Music.click();
      switchTab('compose');
      var ta = $('#compose-input'); if (ta) ta.focus();
    });
    $('#sheet-badge').addEventListener('click', function () {
      if (window.Music) window.Music.click();
      openBadge(p.badgeId);
    });
  }

  /* ============================================================
     2. 赋诗阁
     ============================================================ */
  function renderCompose() {
    var p = poetById(window.Store.get().poetId);
    var box = $('#compose-poet');
    if (box) {
      if (!p) {
        box.innerHTML = '<div class="mini"></div><div class="who"><strong>尚未择诗魂</strong>' +
          '<span>请先到「择诗魂」选一位诗人</span></div>';
      } else {
        box.innerHTML = '<div class="mini"><img src="' + p.portrait + '" alt=""></div>' +
          '<div class="who"><strong>' + esc(p.name) + '</strong><span>' + esc(p.styleName) +
          ' · 信物：' + esc(p.relics.join('、')) + '</span></div>';
      }
    }
    $$('#form-seg button').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-form') === S.form);
    });
    updateEngineHint();
    renderCollection();
  }

  /* 赋诗引擎状态提示（本地词库 / 大模型） */
  function updateEngineHint() {
    var el = $('#engine-hint');
    if (!el) return;
    if (window.LLM && window.LLM.ready()) {
      var cfg = window.LLM.getCfg();
      el.innerHTML = '生成引擎：<b>大模型 · ' + esc(window.LLM.providerLabel(cfg)) +
        '</b>（' + esc(cfg.model) + '，未应时自动回退本地词库） · <a href="javascript:;" id="engine-setup">设置</a>';
    } else {
      el.innerHTML = '生成引擎：<b>本地词库</b> · <a href="javascript:;" id="engine-setup">接入大模型</a>';
    }
    var link = $('#engine-setup');
    if (link) link.addEventListener('click', openLlmSettings);
  }

  /* ---------------- 大模型设置 ---------------- */
  function openLlmSettings() {
    if (!window.LLM) return;
    var cfg = window.LLM.getCfg();
    var providers = window.LLM.providers();
    var root = $('#modal-root');

    var opts = Object.keys(providers).map(function (k) {
      return '<option value="' + k + '"' + (cfg.provider === k ? ' selected' : '') + '>' +
        esc(providers[k].label) + '</option>';
    }).join('');

    root.innerHTML =
      '<div class="modal-mask" data-close="1"></div>' +
      '<div class="modal">' +
        '<button class="m-close" data-close="1">✕</button>' +
        '<h3 class="m-title">接入大模型</h3>' +
        '<div class="m-sub">诗魂借大模型之笔赋诗 · 未配置或未应时使用本地词库</div>' +
        '<div class="llm-form">' +
          '<label class="llm-switch"><input type="checkbox" id="llm-enabled"' + (cfg.enabled ? ' checked' : '') + '>' +
            '<span>启用大模型生成诗词</span></label>' +
          '<div class="f-row"><label class="field-label" for="llm-provider">服务商</label>' +
            '<select id="llm-provider">' + opts + '</select></div>' +
          '<div class="f-row"><label class="field-label" for="llm-key">API Key（仅存本机浏览器，不上传）</label>' +
            '<input type="password" id="llm-key" placeholder="sk-..." value="' + esc(cfg.apiKey) + '" autocomplete="off"></div>' +
          '<div class="f-row" id="llm-url-row"' + (cfg.provider === 'custom' ? '' : ' hidden') + '>' +
            '<label class="field-label" for="llm-url">接口地址</label>' +
            '<input type="text" id="llm-url" placeholder="https://.../chat/completions" value="' + esc(cfg.url) + '"></div>' +
          '<div class="f-row"><label class="field-label" for="llm-model">模型</label>' +
            '<input type="text" id="llm-model" value="' + esc(cfg.model) + '"></div>' +
          '<div class="llm-note" id="llm-test-result">密钥仅保存在本机 localStorage，重置存档不会清除；' +
            '直连官方接口，若遇跨域限制请用 start.bat 启动。</div>' +
        '</div>' +
        '<div class="m-foot">' +
          '<button class="ghost-btn" id="llm-test">测试连接</button>' +
          '<button class="primary-btn" id="llm-save">保 存</button>' +
          '<button class="ghost-btn" data-close="1">关 闭</button>' +
        '</div>' +
      '</div>';
    root.classList.add('is-open');

    $$('[data-close]', root).forEach(function (el) {
      el.addEventListener('click', closeModal);
    });

    $('#llm-provider').addEventListener('change', function () {
      var k = this.value;
      var preset = providers[k];
      $('#llm-url-row').hidden = (k !== 'custom');
      if (k !== 'custom') {
        $('#llm-model').value = preset.model;
      }
    });

    function formCfg() {
      var k = $('#llm-provider').value;
      var preset = providers[k];
      return {
        enabled: $('#llm-enabled').checked,
        provider: k,
        apiKey: $('#llm-key').value.trim(),
        model: $('#llm-model').value.trim() || preset.model,
        url: (k === 'custom' ? $('#llm-url').value.trim() : preset.url)
      };
    }

    $('#llm-test').addEventListener('click', function () {
      var c = formCfg();
      var note = $('#llm-test-result');
      if (!c.apiKey || !c.url || !c.model) { note.textContent = '请先填齐 API Key、接口地址与模型。'; return; }
      var btn = this;
      btn.disabled = true;
      note.textContent = '正在连接 ' + providers[c.provider].label + ' ……';
      window.LLM.test(c).then(function (msg) {
        btn.disabled = false;
        note.textContent = msg;
      }).catch(function (err) {
        btn.disabled = false;
        note.textContent = '连接失败：' + ((err && err.message) || '未知异常');
      });
    });

    $('#llm-save').addEventListener('click', function () {
      window.LLM.saveCfg(formCfg());
      closeModal();
      syncLlmLabel();
      updateEngineHint();
      var c = window.LLM.getCfg();
      toast(c.enabled && c.apiKey ? '大模型已接入：' + esc(window.LLM.providerLabel(c)) : '已保存（未启用）。', 'good');
    });
  }

  function syncLlmLabel() {
    var btn = $('#btn-llm');
    if (btn) btn.classList.toggle('is-on', !!(window.LLM && window.LLM.ready()));
  }

  function renderCollection() {
    var grid = $('#collection-grid');
    var cnt = $('#collection-count');
    if (!grid) return;
    var list = window.Store.get().poems || [];
    if (cnt) cnt.textContent = list.length + ' 首';
    if (!list.length) {
      grid.innerHTML = '<div class="empty">诗集还空着。写下几句心事，请诗魂落笔。</div>';
      return;
    }
    grid.innerHTML = list.map(function (it) {
      return '<div class="cp-item"><div class="h"><strong>' + esc(it.title) + '</strong><span>' +
        esc((it.dynasty || '') + '·' + it.author) + '</span></div>' +
        '<div class="v">' + esc(it.lines.join('，')) + '。</div></div>';
    }).join('');
  }

  function doGenerate() {
    var p = poetById(window.Store.get().poetId);
    if (!p) {
      toast('先择一位诗魂，才好落笔。', 'warn');
      switchTab('poet');
      return;
    }
    var text = ($('#compose-input') || {}).value || '';
    var paper = $('#poem-paper');
    var btn = $('#btn-generate');
    var useLlm = window.LLM && window.LLM.ready();

    paper.innerHTML = '<p class="paper-hint">' +
      (useLlm ? '诗魂正借大模型之笔，斟酌字句……' : '诗魂沉吟中……') + '</p>';
    if (btn) btn.disabled = true;

    function finish(poem, via) {
      if (btn) btn.disabled = false;
      S.lastPoem = poem;
      renderPoem(poem);
      if (via === 'llm') toast('大模型赋就《' + esc(poem.title) + '》。', 'good');
      if (window.Music) window.Music.click();
      if (window.Ambient && window.Ambient.ink) window.Ambient.ink();
    }

    if (useLlm) {
      window.LLM.compose(p, text, S.form).then(function (poem) {
        finish(poem, 'llm');
      }).catch(function (err) {
        toast('大模型未应（' + esc((err && err.message) || '未知异常') + '），已改用本地词库。', 'warn');
        finish(window.PoemGen.compose(p, text, S.form), 'local');
      });
    } else {
      setTimeout(function () {
        finish(window.PoemGen.compose(p, text, S.form), 'local');
      }, 420);
    }
  }

  function renderPoem(poem) {
    var paper = $('#poem-paper');
    paper.innerHTML =
      '<div class="poem-heng">' +
        '<div class="title">' + esc(poem.title) + '</div>' +
        poem.lines.map(function (l) { return '<div class="verse">' + esc(l) + '</div>'; }).join('') +
      '</div>' +
      '<div class="poem-seal">' + esc(poem.dynasty) + '<br>' + esc(poem.author) + '</div>' +
      '<div class="poem-meta">' +
        '<div>' + esc(poem.preface) + '</div>' +
        '<div>韵脚　' + esc(poem.meta.rhyme) + '</div>' +
        '<div>意象　' + esc(poem.meta.imgs) + '　信物　' + esc(poem.meta.extra) + '</div>' +
        '<div class="cmt">' + esc(poem.author) + '：' + esc(poem.comment) + '</div>' +
      '</div>' +
      '<div class="poem-actions">' +
        '<button class="ghost-btn" id="btn-again">再来一首</button>' +
        '<button class="primary-btn" id="btn-keep">收进诗集</button>' +
      '</div>';

    $('#btn-again').addEventListener('click', doGenerate);
    $('#btn-keep').addEventListener('click', function () {
      window.Store.addPoem({
        title: poem.title, author: poem.author, dynasty: poem.dynasty, lines: poem.lines
      });
      renderCollection();
      toast('已收进诗集。', 'good');
      if (window.Music) window.Music.correct();
    });
  }

  /* ============================================================
     3. 闯诗关
     ============================================================ */
  function renderCategories() {
    var row = $('#cat-row');
    if (!row) return;
    row.innerHTML = (window.CATEGORIES || []).map(function (c) {
      return '<button class="cat-chip" data-cat="' + c.key + '">' + esc(c.name) + '</button>';
    }).join('');
    $$('.cat-chip', row).forEach(function (b) {
      b.addEventListener('click', function () {
        S.cat = b.getAttribute('data-cat');
        $$('.cat-chip', row).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        $('#btn-quiz-start').disabled = false;
        if (window.Music) window.Music.click();
      });
    });
  }

  function startQuiz() {
    if (!S.cat) return;
    var qs = window.QuizBank.build(S.cat, 6);
    if (!qs.length) { toast('此题暂无可用的题目，换一题试试。', 'warn'); return; }
    S.quiz = { qs: qs, idx: 0, score: 0, combo: 0, maxCombo: 0, right: 0, answered: false, left: 15 };
    $('#quiz-setup').hidden = true;
    $('#quiz-result').hidden = true;
    $('#quiz-stage').hidden = false;
    renderQuestion();
  }

  function renderQuestion() {
    var q = S.quiz;
    var card = q.qs[q.idx];
    S.quiz.answered = false;
    S.quiz.left = 15;

    $('#q-index').textContent = (q.idx + 1) + '/' + q.qs.length;
    $('#q-combo').textContent = q.combo;
    $('#q-score').textContent = q.score;
    $('#q-type').textContent = card.typeName;
    $('#q-prompt').textContent = card.prompt;
    var ex = $('#q-explain'); ex.hidden = true; ex.innerHTML = '';

    var box = $('#q-options');
    box.innerHTML = card.options.map(function (o, i) {
      return '<button class="q-opt" data-i="' + i + '"><span class="k">' + 'ABCD'.charAt(i) + '</span>' + esc(o) + '</button>';
    }).join('');
    $$('.q-opt', box).forEach(function (b) {
      b.addEventListener('click', function () { answer(parseInt(b.getAttribute('data-i'), 10)); });
    });

    var bar = $('#q-timer-bar');
    bar.style.width = '100%';
    if (S.timer) clearInterval(S.timer);
    S.timer = setInterval(function () {
      S.quiz.left -= 0.1;
      if (S.quiz.left < 0) S.quiz.left = 0;
      bar.style.width = (S.quiz.left / 15 * 100) + '%';
      if (S.quiz.left <= 0) { answer(-1); }
    }, 100);
  }

  function answer(i) {
    var q = S.quiz;
    if (!q || q.answered) return;
    q.answered = true;
    if (S.timer) { clearInterval(S.timer); S.timer = null; }

    var card = q.qs[q.idx];
    var ok = i === card.answer;
    var opts = $$('.q-opt');
    opts.forEach(function (b, k) {
      b.classList.add('locked');
      if (k === card.answer) b.classList.add('right');
      if (k === i && !ok) b.classList.add('wrong');
    });

    var gain = 0;
    if (ok) {
      gain = 6 + Math.min(q.combo, 5) + Math.floor(q.left / 5);
      q.combo += 1;
      q.maxCombo = Math.max(q.maxCombo, q.combo);
      q.right += 1;
      if (window.Music) window.Music.correct();
    } else {
      q.combo = 0;
      if (window.Music) window.Music.wrong();
    }
    q.score += gain;

    $('#q-combo').textContent = q.combo;
    $('#q-score').textContent = q.score;

    var explain = $('#q-explain');
    explain.innerHTML = (ok ? '<b>+ ' + gain + ' 诗墨</b><br>' : '') + card.explain(ok);
    explain.hidden = false;

    setTimeout(function () {
      q.idx += 1;
      if (q.idx >= q.qs.length) finishQuiz(); else renderQuestion();
    }, ok ? 1250 : 1900);
  }

  function finishQuiz() {
    var q = S.quiz;
    if (!q) return;
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    var total = q.qs.length;
    var acc = q.right / total;
    var rank = acc === 1 ? '诗仙' : acc >= 0.8 ? '诗豪' : acc >= 0.6 ? '诗客' : acc >= 0.4 ? '学童' : '初执笔';
    window.Store.addPoints(q.score);
    window.Store.recordRun(q.score);
    bumpPoints();
    if (window.Music) window.Music.reward();

    var res = $('#quiz-result');
    res.hidden = false;
    res.innerHTML =
      '<div class="rk">' + rank + '</div>' +
      '<div class="rk-sub">' + (window.CATEGORIES.filter(function (c) { return c.key === S.cat; })[0] || {}).name + '关 · 六题闯毕</div>' +
      '<div class="stats">' +
        '<div><b>' + q.right + '/' + total + '</b>答对</div>' +
        '<div><b>' + q.maxCombo + '</b>最高连击</div>' +
        '<div><b>' + q.score + '</b>本次得分</div>' +
      '</div>' +
      '<div class="gain">诗墨积分 +' + q.score + '</div>' +
      '<div class="btns"><button class="primary-btn" id="btn-again-run">再闯一关</button>' +
      '<button class="ghost-btn" id="btn-badge-shop">去徽章阁</button></div>';
    $('#quiz-stage').hidden = true;
    $('#quiz-setup').hidden = false;
    $('#btn-quiz-start').disabled = !S.cat;

    $('#btn-again-run').addEventListener('click', function () { S.quiz = null; startQuiz(); });
    $('#btn-badge-shop').addEventListener('click', function () { switchTab('badge'); });
    S.quiz = null;
    renderBadges();
  }

  function endQuiz() {
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    S.quiz = null;
    var st = $('#quiz-stage'); if (st) st.hidden = true;
    var su = $('#quiz-setup'); if (su) su.hidden = false;
  }

  /* ============================================================
     4. 徽章阁
     ============================================================ */
  function renderBadges() {
    var grid = $('#badge-grid');
    if (!grid) return;
    var st = window.Store.get();
    grid.innerHTML = '';
    (window.BADGES || []).forEach(function (b) {
      var owned = window.Store.has(b.id);
      var card = document.createElement('div');
      card.className = 'badge-card' + (owned ? ' owned' : ' locked');
      card.setAttribute('data-id', b.id);

      var foot;
      if (owned) {
        foot = '<div class="owned-tag">已珍藏 · 重工徽章</div>';
      } else {
        var afford = st.points >= b.cost;
        foot = '<div class="cost">需 <b>' + b.cost + '</b> 诗墨</div>' +
               '<button class="mini-btn" data-redeem="' + b.id + '"' + (afford ? '' : ' disabled') + '>' +
               (afford ? '兑 换' : '积分不足') + '</button>';
      }

      card.innerHTML =
        '<div class="badge-art"><img src="' + b.image + '" alt="' + esc(b.name) + '"></div>' +
        '<div class="badge-info">' +
          '<div class="bn"><strong>' + esc(b.name) + '</strong><em>' + esc(b.tier) + '</em></div>' +
          '<div class="owner">' + esc(b.poetId ? (poetById(b.poetId) || {}).name : '') + ' · ' + esc(b.elements.join('／')) + '</div>' +
          '<div class="craft">' + esc(b.craft) + '</div>' +
        '</div>' +
        '<div class="badge-foot">' + foot + '</div>';

      card.addEventListener('click', function () { openBadge(b.id); });
      var btn = card.querySelector('[data-redeem]');
      if (btn) btn.addEventListener('click', function (e) {
        e.stopPropagation();
        redeem(b.id);
      });
      grid.appendChild(card);
    });
  }

  function redeem(id) {
    var b = badgeById(id);
    if (!b) return;
    if (window.Store.has(b.id)) { toast('这枚徽章已在你的匣中。'); return; }
    if (!window.Store.spend(b.cost)) { toast('诗墨不足，再去闯几关吧。', 'warn'); return; }
    window.Store.unlock(b.id);
    bumpPoints();
    if (window.Music) window.Music.reward();
    renderBadges();
    toast('得徽章一枚：<b>' + esc(b.name) + '</b>', 'good');
    setTimeout(function () { openBadge(b.id); }, 520);
  }

  function openBadge(id) {
    var b = badgeById(id);
    if (!b) return;
    var p = poetById(b.poetId) || { name: '', dynasty: '' };
    var owned = window.Store.has(b.id);
    var root = $('#modal-root');
    root.innerHTML =
      '<div class="modal-mask" data-close="1"></div>' +
      '<div class="modal">' +
        '<button class="m-close" data-close="1">✕</button>' +
        '<h3 class="m-title">' + esc(b.name) + '</h3>' +
        '<div class="m-sub">' + esc(p.dynasty + '·' + p.name) + ' 专属 · ' + esc(b.tier) + '徽章 · ' +
          (owned ? '已珍藏' : '未得') + '</div>' +
        '<div class="m-art"><img src="' + b.image + '" alt="' + esc(b.name) + '"></div>' +
        '<div class="m-craft"><b>' + esc(b.craft) + '</b><br>元素：' + esc(b.elements.join(' · ')) +
          '<br>配色：' + esc(b.colorway) + '</div>' +
        '<div class="m-body">' + esc(b.desc) + '</div>' +
        '<div class="m-body"><b>缘起</b>　' + esc(b.story) + '</div>' +
        '<div class="m-quote">' + esc(b.quote) + '</div>' +
        '<div class="m-foot">' +
          (owned ? '' : '<button class="primary-btn" id="m-redeem">以 ' + b.cost + ' 诗墨兑换</button>') +
          '<button class="ghost-btn" data-close="1">关 闭</button>' +
        '</div>' +
      '</div>';
    root.classList.add('is-open');
    $$('[data-close]', root).forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    var rb = $('#m-redeem');
    if (rb) rb.addEventListener('click', function () { redeem(b.id); });
  }

  function closeModal() {
    var root = $('#modal-root');
    root.classList.remove('is-open');
    root.innerHTML = '';
  }

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    // 标签栏
    $$('#tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (window.Music) window.Music.click();
        switchTab(b.getAttribute('data-tab'));
      });
    });

    // 体型切换
    $$('#form-seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.form = b.getAttribute('data-form');
        renderCompose();
        if (window.Music) window.Music.click();
      });
    });

    $('#btn-generate').addEventListener('click', doGenerate);
    $('#btn-quiz-start').addEventListener('click', function () { if (window.Music) window.Music.click(); startQuiz(); });
    $('#btn-quiz-quit').addEventListener('click', function () { endQuiz(); if (window.Music) window.Music.click(); });

    // 大模型设置
    $('#btn-llm').addEventListener('click', function () {
      if (window.Music) window.Music.click();
      openLlmSettings();
    });

    // 音乐
    $('#btn-bgm').addEventListener('click', function () {
      var on = window.Music.toggle();
      var btn = $('#btn-bgm');
      btn.classList.toggle('is-on', !!on);
      $('#bgm-label').textContent = on ? '乐 ♪' : '乐';
      toast(on ? '丝竹已起。' : '已静音。');
    });

    // 重置
    $('#btn-reset').addEventListener('click', function () {
      if (!window.confirm('确定重置全部进度？诗墨积分、诗集与已得徽章都会清空。')) return;
      window.Store.reset();
      S.quiz = null;
      renderPoets(); renderSheet(); renderCompose(); renderBadges(); syncTop();
      toast('已重置存档。', 'warn');
    });

    // Esc 关弹层
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    // 文本域：Ctrl/Cmd + Enter 直接赋诗
    $('#compose-input').addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doGenerate();
    });

    window.Store.on(function () { syncTop(); });

    renderPoets();
    renderCategories();
    renderSheet();
    renderCompose();
    renderBadges();
    syncTop();
    syncLlmLabel();

    if (window.Store.get().poetId) switchTab('poet'); else switchTab('poet');
  }

  return { init: init, toast: toast };
})();
