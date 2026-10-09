/* 启动引导 */
(function (S) {
  // 启动失败时给出可见提示，避免「点了没反应」的黑盒状态
  function fatal(e) {
    console.error('[启动失败]', e);
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99;' +
      'background:#fff3cd;border:2px solid #e8453c;border-radius:12px;padding:10px 14px;' +
      'font:700 13px/1.6 system-ui;color:#7a1c16;';
    box.textContent = '启动出错：' + (e && e.message ? e.message : e) + '　（详情见浏览器控制台）';
    document.body.appendChild(box);
  }

  function boot() {
    const canvas = document.getElementById('game');
    const game = new S.Game(canvas);

    S.Input.init();
    try { S.UI.init(game); } catch (e) { fatal(e); throw e; }
    S.Audio.probeSfx();

    // 首次交互解锁音频上下文（浏览器自动播放策略）
    const unlock = function () {
      S.Audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    window.addEventListener('resize', function () { game.setupDPR(); });

    game.run();
  }

  function start() {
    try { boot(); } catch (e) { fatal(e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.SHIN);
