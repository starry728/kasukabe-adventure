/* 在真实 Chrome 中加载 index.html，模拟完整点击流程并捕获运行时错误 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const probe = `
<script>
window.__err = [];
window.addEventListener('error', function (e) {
  window.__err.push((e.message || '') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', function (e) {
  window.__err.push('promise: ' + (e.reason && e.reason.message));
});
</script>
`;

const report = `
<script>
var log = [];
function step(name, cond, extra) { log.push((cond ? 'OK ' : 'FAIL ') + name + (extra ? ' -> ' + extra : '')); }
function vis(id) { return !document.getElementById(id).classList.contains('hidden'); }
function click(id) { document.getElementById(id).dispatchEvent(new MouseEvent('click', { bubbles: true })); }
function wait(fn, ms) {
  return new Promise(function (res) {
    var t0 = Date.now();
    (function tick() {
      var v = false;
      try { v = fn(); } catch (e) { }
      if (v) return res(true);
      if (Date.now() - t0 > ms) return res(false);
      setTimeout(tick, 50);
    })();
  });
}

setTimeout(function () { (async function () {
  step('选人卡片已生成', document.querySelectorAll('.char-card').length === 5, document.querySelectorAll('.char-card').length + '张');
  step('初始停在标题页', vis('screen-title'));

  click('btn-start');
  step('点击开始游戏 -> 进入选人页', vis('screen-select') && !vis('screen-title'));

  var cards = document.querySelectorAll('.char-card');
  cards[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  step('可切换角色', window.SHIN.UI.charId === 'nene', window.SHIN.UI.charId);

  click('btn-go');
  var g = window.SHIN.UI.game;
  step('点击开始冒险 -> HUD 显示', vis('hud'));
  step('游戏状态 playing', g.state === 'playing', g.state);

  // 按住右键跑 90 帧，确保真实 canvas 渲染无异常
  window.SHIN.Input.down.right = true;
  for (var i = 0; i < 90; i++) {
    if (i % 30 === 0) window.SHIN.Input.pressed.jump = true;
    try { g.update(1 / 60); g.render(); } catch (e) { step('帧更新异常', false, e.message); break; }
  }
  step('玩家已向前移动', g.player.x > 100, 'x=' + Math.round(g.player.x));

  // canvas 是否真的画了东西
  try {
    var cv = document.getElementById('game');
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    var n = 0;
    for (var k = 3; k < d.length; k += 4000) { if (d[k] > 0) n++; }
    step('canvas 有实际绘制内容', n > 0, '采样命中 ' + n);
  } catch (e) { step('canvas 读取失败', false, e.message); }

  window.SHIN.UI.togglePause();
  step('可暂停', g.paused && vis('screen-pause'));
  window.SHIN.UI.togglePause();

  g.emit('clear', g);
  step('通关 -> 结算页', vis('screen-result'));
  document.getElementById('btn-home').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  step('返回标题页', vis('screen-title'));

  // 离线模式下排行榜应正常降级（不报错，显示空态或本机成绩）
  click('btn-rank');
  var okRank = await wait(function () {
    var b = document.getElementById('rank-body');
    return b.querySelector('.rank-row') || /还没有成绩/.test(b.textContent);
  }, 4000);
  step('排行榜可打开（离线降级）', okRank && vis('screen-rank'),
    document.getElementById('rank-status').textContent);
  document.getElementById('btn-rank-back').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  step('排行榜可返回', vis('screen-title'));

  var errs = window.__err.length ? window.__err.join(' ||| ') : 'NO_ERROR';
  document.title = '##DIAG## ' + log.join(' ;; ') + ' ::ERRORS:: ' + errs;
  })(); }, 900);
</script>
`;

html = html.replace('<head>', '<head>' + probe);
html = html.replace('</body>', report + '</body>');
const out = path.join(root, '_diag.html');
fs.writeFileSync(out, html, 'utf8');

const target = process.argv[2] === 'file'
  ? 'file:///' + out.replace(/\\/g, '/')
  : 'http://127.0.0.1:8123/_diag.html';

let dom = '';
try {
  dom = execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=6000',
    '--dump-dom',
    target
  ], { encoding: 'utf8', maxBuffer: 60 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  console.log('启动 Chrome 失败：' + e.message);
  process.exit(2);
}

const m = dom.match(/<title>([\s\S]*?)<\/title>/);
const title = m ? m[1] : '(未取到 title)';
const idx = title.indexOf('::ERRORS::');
console.log('--- 交互流程 ---');
console.log((idx >= 0 ? title.slice(0, idx) : title).split(' ;; ').join('\n'));
console.log('\n--- 运行时错误 ---');
console.log(idx >= 0 ? title.slice(idx + 11) : '(无)');
try { fs.unlinkSync(out); } catch (e) { }
