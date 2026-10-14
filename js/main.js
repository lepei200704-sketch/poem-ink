/* ============================================================
   启动入口
   ============================================================ */
(function () {
  function boot() {
    try { if (window.HUD) window.HUD.init(); } catch (e) { /* noop */ }
    try { if (window.Ambient) window.Ambient.start(); } catch (e) { /* noop */ }

    // 空白处的点击 → 一点墨花
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('#app')) return;
      if (window.Ambient) window.Ambient.ink(e.clientX, e.clientY);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
