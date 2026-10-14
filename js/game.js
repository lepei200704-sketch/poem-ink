/* ============================================================
   Phaser 环境场景层（透明画布，仅负责氛围动画）
   落花 · 流云 · 飞鸟 · 墨点。玩法状态不在这里，全部由 HUD/系统层持有。
   ============================================================ */
window.Ambient = (function () {
  var game = null, scene = null;

  function makeTextures(s) {
    var g = s.add.graphics();
    // 花瓣
    g.fillStyle(0xf3b9c8, 1);
    g.fillEllipse(6, 4, 12, 7);
    g.generateTexture('pk-petal', 12, 8);
    g.clear();
    // 墨点 / 飞絮
    g.fillStyle(0x2b2520, 1);
    g.fillCircle(3, 3, 2.6);
    g.generateTexture('pk-dot', 6, 6);
    g.clear();
    // 流云
    g.fillStyle(0xffffff, 0.7);
    g.fillEllipse(90, 26, 180, 44);
    g.fillEllipse(52, 34, 96, 34);
    g.fillEllipse(136, 32, 108, 38);
    g.generateTexture('pk-cloud', 180, 52);
    g.clear();
    // 飞鸟（简笔折线）
    g.lineStyle(2, 0x2b2520, 0.8);
    g.beginPath();
    g.moveTo(0, 7); g.lineTo(7, 0); g.lineTo(14, 7);
    g.strokePath();
    g.generateTexture('pk-bird', 14, 8);
    g.destroy();
  }

  function AmbientScene() {
    Phaser.Scene.call(this, { key: 'ambient' });
  }
  AmbientScene.prototype = Object.create(Phaser.Scene.prototype);
  AmbientScene.prototype.constructor = AmbientScene;

  AmbientScene.prototype.create = function () {
    var self = this;
    makeTextures(this);

    // 落花
    this.petals = this.add.particles(0, 0, 'pk-petal', {
      x: { min: -40, max: 2560 }, y: -24,
      lifespan: { min: 9000, max: 17000 },
      speedY: { min: 16, max: 48 },
      speedX: { min: -30, max: 12 },
      scale: { min: 0.5, max: 1.15 },
      alpha: { start: 0.8, end: 0.25 },
      rotate: { min: 0, max: 360 },
      frequency: 380, quantity: 1
    }).setDepth(3);

    // 空中飞絮 / 微尘
    this.add.particles(0, 0, 'pk-dot', {
      x: { min: -20, max: 2560 }, y: { min: 0, max: 900 },
      lifespan: { min: 6000, max: 12000 },
      speedX: { min: -8, max: 14 }, speedY: { min: -14, max: -4 },
      scale: { min: 0.3, max: 0.9 },
      alpha: { start: 0.18, end: 0 },
      frequency: 900, quantity: 1
    }).setDepth(1);

    // 流云
    this.clouds = [];
    for (var i = 0; i < 4; i++) {
      var c = this.add.image(
        Phaser.Math.Between(0, 2560),
        Phaser.Math.Between(40, 260),
        'pk-cloud'
      ).setAlpha(Phaser.Math.FloatBetween(0.10, 0.26))
        .setScale(Phaser.Math.FloatBetween(1.2, 2.6))
        .setDepth(0);
      this.tweens.add({
        targets: c, x: c.x + 900,
        duration: Phaser.Math.Between(60000, 110000), repeat: -1
      });
      this.clouds.push(c);
    }

    // 飞鸟
    for (var b = 0; b < 3; b++) this.bird(b);

    this.scale.on('resize', function () {
      if (!self.clouds) return;
      var w = self.scale.width;
      self.clouds.forEach(function (c) { if (c.x > w + 400) c.x = -200; });
    });
  };

  AmbientScene.prototype.bird = function (i) {
    var self = this;
    var b = this.add.image(-40, Phaser.Math.Between(80, 260), 'pk-bird')
      .setAlpha(0.42)
      .setScale(Phaser.Math.FloatBetween(0.8, 1.5))
      .setDepth(2);
    this.tweens.add({
      targets: b,
      angle: { from: -4, to: 4 },
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut'
    });
    this.tweens.add({
      targets: b,
      x: (self.scale.width || window.innerWidth) + 100,
      duration: Phaser.Math.Between(24000, 44000),
      repeat: -1,
      delay: i * 5000,
      onRepeat: function () { b.y = Phaser.Math.Between(70, 250); }
    });
  };

  AmbientScene.prototype.ink = function (x, y) {
    if (!this.scene || !this.scene.isActive()) return;
    var w = this.scale.width || window.innerWidth;
    var h = this.scale.height || window.innerHeight;
    var px = (typeof x === 'number') ? x : w / 2;
    var py = (typeof y === 'number') ? y : h / 2.3;
    var e = this.add.particles(px, py, 'pk-dot', {
      speed: { min: 20, max: 110 },
      lifespan: 1300,
      scale: { start: 1.0, end: 0 },
      alpha: { start: 0.5, end: 0 },
      quantity: 16,
      emitting: false
    }).setDepth(4);
    e.explode(16, px, py);
    this.time.delayedCall(1500, function () { e.destroy(); });
  };

  return {
    start: function () {
      var host = document.getElementById('scene-root');
      if (!host || !window.Phaser) return;
      try {
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: host,
          transparent: true,
          banner: false,
          audio: { noAudio: true },
          scale: {
            mode: Phaser.Scale.RESIZE,
            width: window.innerWidth,
            height: window.innerHeight
          },
          scene: [AmbientScene]
        });
        game.events.once('ready', function () { scene = game.scene.getScene('ambient'); });
      } catch (err) {
        /* 场景层失败不影响玩法 */
      }
    },
    ink: function (x, y) {
      var s = (game && game.scene) ? game.scene.getScene('ambient') : null;
      if (s && s.ink) { try { s.ink(x, y); } catch (e) {} }
    }
  };
})();
