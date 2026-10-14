/* ============================================================
   程序化古风配乐 / 音效（Web Audio 合成，无需外部音频文件）
   五声音阶（宫商角徵羽）古琴拨弦音色 + 反馈延时混响
   ============================================================ */
window.Music = (function () {
  var ctx = null, master = null, musicBus = null, sfxBus = null, fb = null;
  var timer = null, step = 0, playing = false;

  var PENTA = [0, 2, 4, 7, 9];      // 宫 商 角 徵 羽
  var ROOT = 196;                   // G3
  var SCALE = [];
  (function buildScale() {
    for (var o = 0; o < 3; o++) {
      for (var i = 0; i < PENTA.length; i++) {
        SCALE.push(ROOT * Math.pow(2, o + PENTA[i] / 12));
      }
    }
  })();

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(ctx.destination);

    musicBus = ctx.createGain(); musicBus.gain.value = 0.5;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.6;

    // 反馈延时：营造庭院回响
    fb = ctx.createDelay(1.0); fb.delayTime.value = 0.34;
    var fbg = ctx.createGain(); fbg.gain.value = 0.34;
    var damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 2200;
    musicBus.connect(master);
    musicBus.connect(fb); fb.connect(damp); damp.connect(fbg); fbg.connect(fb); fbg.connect(master);
    sfxBus.connect(master);
    return ctx;
  }

  // 一次拨弦
  function pluck(freq, at, dur, vol) {
    if (!ctx) return;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);

    var o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = freq;
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.006;
    var g2 = ctx.createGain(); g2.gain.value = 0.32;

    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicBus);
    o1.start(at); o2.start(at);
    o1.stop(at + dur + 0.06); o2.stop(at + dur + 0.06);
  }

  // 低音持续音（如古琴散音）
  function drone(at, freq, dur) {
    if (!ctx) return;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.10, at + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0006, at + dur);
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(musicBus);
    o.start(at); o.stop(at + dur + 0.1);
  }

  var PATTERN = [0, 2, 4, 3, 5, 4, 7, 6, 5, 3, 2, 4, 6, 5, 7, 9];
  function scheduleStep() {
    if (!ctx || !playing) return;
    var t = ctx.currentTime + 0.05;
    var idx = PATTERN[step % PATTERN.length] + (Math.random() < 0.22 ? 1 : 0);
    var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, idx))];
    pluck(f, t, 2.1 + Math.random() * 0.7, 0.20 + Math.random() * 0.08);

    // 偶发叠音，形成简单旋律
    if (Math.random() < 0.4) {
      pluck(SCALE[Math.max(0, Math.min(SCALE.length - 1, idx + 2))], t + 0.28, 1.5, 0.12);
    }
    // 每 8 步一次低音散音
    if (step % 8 === 0) drone(t, SCALE[Math.floor(step / 8) % 3], 4.2);

    step++;
  }

  function beep(freq, at, dur, vol, type, bus) {
    if (!ctx) return;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    var o = ctx.createOscillator(); o.type = type || 'triangle'; o.frequency.value = freq;
    o.connect(g); g.connect(bus || sfxBus);
    o.start(at); o.stop(at + dur + 0.05);
  }

  return {
    isPlaying: function () { return playing; },

    toggle: function () {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      if (playing) {
        playing = false;
        if (timer) { clearInterval(timer); timer = null; }
        musicBus.gain.value = 0;
        return false;
      }
      playing = true;
      musicBus.gain.value = 0.5;
      if (timer) clearInterval(timer);
      timer = setInterval(scheduleStep, 1150);
      scheduleStep();
      return true;
    },

    correct: function () {
      if (!ensure() || ctx.state === 'suspended') return;
      var t = ctx.currentTime;
      beep(660, t, 0.28, 0.22); beep(990, t + 0.09, 0.34, 0.18);
    },
    wrong: function () {
      if (!ensure() || ctx.state === 'suspended') return;
      var t = ctx.currentTime;
      beep(233, t, 0.26, 0.20, 'sawtooth'); beep(175, t + 0.10, 0.34, 0.16, 'sawtooth');
    },
    reward: function () {
      if (!ensure() || ctx.state === 'suspended') return;
      var t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        beep(f, t + i * 0.10, 0.6, 0.20);
      });
    },
    click: function () {
      if (!ensure() || ctx.state === 'suspended') return;
      beep(880, ctx.currentTime, 0.07, 0.10, 'sine');
    }
  };
})();
