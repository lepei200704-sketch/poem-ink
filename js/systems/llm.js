/* ============================================================
   大模型接入层：以 OpenAI 兼容协议调用国内主流服务商
   - 配置仅存本机 localStorage（键 poem-ink-llm-v1），不上传、不重置
   - 与规则引擎解耦：返回结构与 PoemGen.compose 完全一致
   - 任何失败（网络/跨域/校验不通过）由调用方回退本地词库
   ============================================================ */
window.LLM = (function () {
  var KEY = 'poem-ink-llm-v1';

  /* 服务商预设：均为 OpenAI 兼容 /chat/completions 协议，支持浏览器跨域调用 */
  var PROVIDERS = {
    deepseek: {
      label: 'DeepSeek 深度求索',
      url: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat'
    },
    qwen: {
      label: '通义千问 · 阿里云百炼',
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      model: 'qwen-plus'
    },
    moonshot: {
      label: 'Kimi · 月之暗面',
      url: 'https://api.moonshot.cn/v1/chat/completions',
      model: 'moonshot-v1-8k'
    },
    zhipu: {
      label: '智谱 GLM（glm-4-flash 免费）',
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      model: 'glm-4-flash'
    },
    custom: {
      label: '自定义（OpenAI 兼容接口）',
      url: '',
      model: ''
    }
  };

  var DEF = { enabled: false, provider: 'deepseek', apiKey: '', model: 'deepseek-chat', url: PROVIDERS.deepseek.url };

  function getCfg() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return Object.assign({}, DEF);
      var c = JSON.parse(raw);
      var out = Object.assign({}, DEF, c);
      return out;
    } catch (e) { return Object.assign({}, DEF); }
  }

  function saveCfg(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* 隐私模式容错 */ }
  }

  function providers() { return PROVIDERS; }

  /* 是否可用：开了开关 + 密钥 + 地址 + 模型齐全 */
  function ready() {
    var c = getCfg();
    return !!(c.enabled && c.apiKey && c.url && c.model);
  }

  function providerLabel(c) {
    var p = PROVIDERS[c.provider];
    return p ? p.label : c.provider;
  }

  /* ---------------- 请求 ---------------- */
  function chat(cfg, messages, timeoutMs) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 22000);
    return fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        temperature: 0.9,
        max_tokens: 400
      }),
      signal: ctrl.signal
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('HTTP ' + res.status + (t ? ' · ' + t.slice(0, 90) : ''));
        });
      }
      return res.json();
    }, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('请求超时');
      throw new Error('网络不可达或跨域被拒');
    }).then(function (data) {
      var choice = data && data.choices && data.choices[0];
      var txt = choice && choice.message && choice.message.content;
      if (!txt) throw new Error('模型返回为空');
      return txt;
    });
  }

  /* ---------------- Prompt ---------------- */
  function buildMessages(poet, text, form) {
    var is7 = form === '七言绝句';
    var imagery = poet.lexicon.open.concat(poet.lexicon.collo.slice(0, 5)).join('、');
    var clean = (text || '').replace(/\s+/g, ' ').trim();

    var sys =
      '你是' + poet.dynasty + '代诗人' + poet.name +
      (poet.zi ? '（字' + poet.zi + (poet.hao ? '，号' + poet.hao : '') + '）' : (poet.hao ? '（号' + poet.hao + '）' : '')) +
      '，诗风人称「' + poet.styleName + '」，特点是' + poet.styleTags.join('、') + '。' +
      poet.bio +
      '你的随身旧物与常用意象：' + poet.relics.join('、') + '；惯用意象如：' + imagery + '。' +
      '现在有人向你倾诉心事，请你以完全属于自己的口吻与诗风，代其创作一首' + form + '。' +
      '要求：' +
      '1. 共四句，每句恰好' + (is7 ? '七' : '五') + '个汉字，符合绝句格律，第二、四句押韵（首句可入韵）。' +
      '2. 紧扣对方心事立意，化用其语意为古典意象，不可出现现代词汇与白话。' +
      '3. 另拟诗题，二至六字，不要含「绝句」二字。' +
      '4. 再以' + poet.name + '的口吻写一句三十字以内的评语，语气要符合其性格。' +
      '只输出 JSON，不要输出任何其他内容：' +
      '{"title":"诗题","lines":["第一句","第二句","第三句","第四句"],"comment":"评语"}';

    var user = clean
      ? '我的心事：' + clean
      : '我此时无言，只想要一首最像你手笔的' + form + '，题意自拟。';

    return [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ];
  }

  /* ---------------- 解析与校验 ---------------- */
  var PUNCT = /[\s，。！？、；：,.!?;:…—“”‘’"'（）()《》〈〉·\-]/g;

  function cleanLine(l) { return String(l == null ? '' : l).replace(PUNCT, ''); }

  function extractJson(s) {
    var i = s.indexOf('{');
    var j = s.lastIndexOf('}');
    if (i < 0 || j <= i) throw new Error('返回内容不是 JSON');
    try { return JSON.parse(s.slice(i, j + 1)); }
    catch (e) { throw new Error('JSON 解析失败'); }
  }

  /* 把模型输出规整成与 PoemGen.compose 相同的结构 */
  function normalize(poet, text, form, raw, cfg) {
    var is7 = form === '七言绝句';
    var need = is7 ? 7 : 5;
    var obj = extractJson(raw);

    var lines = obj.lines;
    if (!Array.isArray(lines)) throw new Error('缺少诗句');

    /* 容错：有的模型把四句合成两句（中间用逗号），拆开再校验 */
    if (lines.length === 2) {
      var flat = [];
      lines.forEach(function (l) {
        String(l).split(/[，。；,;]/).forEach(function (seg) {
          var c = cleanLine(seg);
          if (c) flat.push(c);
        });
      });
      lines = flat;
    }
    lines = lines.map(cleanLine).filter(function (l) { return l.length > 0; });

    if (lines.length !== 4) throw new Error('句数不对（' + lines.length + '/4）');
    for (var i = 0; i < 4; i++) {
      if (lines[i].length !== need) throw new Error('第' + (i + 1) + '句字数不对（' + lines[i].length + '/' + need + '）');
    }

    var title = String(obj.title || '').replace(/[《》\s]/g, '').slice(0, 8);
    if (!title) title = poet.lexicon.open[Math.floor(Math.random() * poet.lexicon.open.length)] + '吟';

    var comment = String(obj.comment || '').replace(/\s+/g, '').slice(0, 60);
    if (!comment) comment = poet.replies[Math.floor(Math.random() * poet.replies.length)];

    var clean = (text || '').replace(/\s+/g, ' ').trim();
    var preface = clean
      ? '「' + clean.substr(0, 40) + '」——' + poet.name + '借大模型之笔，以' + poet.styleName + '和之'
      : poet.name + '乘兴落笔，得' + (is7 ? '七言' : '五言') + '一首';

    /* 复用规则引擎的关键词提取，仅用于展示“创作参数” */
    var kws = (window.PoemGen && window.PoemGen.keywords) ? window.PoemGen.keywords(text) : [];

    return {
      title: title,
      author: poet.name,
      dynasty: poet.dynasty,
      styleName: poet.styleName,
      form: form,
      lines: lines,
      preface: preface,
      comment: comment,
      meta: {
        rhyme: '大模型赋就 · ' + providerLabel(cfg) + '（' + cfg.model + '）',
        imgs: kws.length ? kws.join(' · ') : poet.lexicon.open.slice(0, 3).join(' · '),
        extra: poet.relics.slice(0, 2).join(' · ')
      },
      poetId: poet.id,
      seed: clean,
      via: 'llm'
    };
  }

  /* ---------------- 对外 ---------------- */
  function compose(poet, text, form) {
    var cfg = getCfg();
    return chat(cfg, buildMessages(poet, text, form), 22000)
      .then(function (raw) { return normalize(poet, text, form, raw, cfg); });
  }

  /* 设置弹层里的「测试连接」：一次最小请求 */
  function test(cfg) {
    return chat(cfg, [
      { role: 'user', content: '只回复一个字：好' }
    ], 15000).then(function (txt) {
      return '连接成功，模型应答：' + txt.replace(/\s+/g, '').slice(0, 20);
    });
  }

  return {
    getCfg: getCfg,
    saveCfg: saveCfg,
    providers: providers,
    providerLabel: providerLabel,
    ready: ready,
    compose: compose,
    test: test
  };
})();
