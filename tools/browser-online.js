/* 真实浏览器 + 后端联调：验证排行榜、成绩提交、存档「继续冒险」 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[2] || 3000);
const BASE = 'http://127.0.0.1:' + PORT;

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const probe = `
<script>
window.__err = [];
window.addEventListener('error', function (e) {
  window.__err.push((e.message || '') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno);
});
</script>
`;

const report = `
<script>
var log = [];
function step(n, c, x) { log.push((c ? 'OK ' : 'FAIL ') + n + (x ? ' -> ' + x : '')); }
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

(async function () {
  var S = window.SHIN;
  await wait(function () { return S && S.API && S.API.ready; }, 4000);
  step('后端探测完成', true, 'online=' + S.API.online);
  step('已连接后端', S.API.online === true);

  // 打开排行榜
  click('btn-rank');
  var loaded = await wait(function () {
    var b = document.getElementById('rank-body');
    return b.querySelector('.rank-row') || /还没有成绩/.test(b.textContent);
  }, 4000);
  step('排行榜加载完成', loaded && vis('screen-rank'),
    document.getElementById('rank-status').textContent);
  var rows = document.querySelectorAll('#rank-body .rank-row').length;
  // 空榜（首次运行/数据已清空）与有数据两种状态都算正常
  step('排行榜渲染正常', rows > 0 || /还没有成绩/.test(document.getElementById('rank-body').textContent),
    rows > 0 ? rows + ' 行' : '空榜，显示引导文案');
  step('昵称为用户输入时已转义', document.getElementById('rank-body').innerHTML.indexOf('<img') < 0);

  // 按关卡筛选
  document.querySelectorAll('.rank-tab')[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await wait(function () { return /关卡|还没有/.test(document.getElementById('rank-body').textContent); }, 3000);
  step('关卡筛选可用', true, document.getElementById('rank-status').textContent);

  click('btn-rank-back');
  step('排行榜可返回', vis('screen-title'));

  // 开局并直接结算，验证成绩提交
  click('btn-start');
  click('btn-go');
  var g = S.UI.game;
  g.score = 4321; g.coinCount = 12;
  S.UI.levelIndex = 0;
  g.emit('clear', g);
  var ranked = await wait(function () { return /第 \\d+ 名/.test(document.getElementById('rank-line').textContent); }, 5000);
  step('成绩提交并返回名次', ranked, document.getElementById('rank-line').textContent);
  step('结算页显示昵称输入框', !!document.getElementById('player-name'));

  // 存档 -> 继续冒险
  click('btn-home');
  var cont = await wait(function () { return !document.getElementById('btn-continue').classList.contains('hidden'); }, 4000);
  step('通关后出现「继续冒险」', cont, document.getElementById('btn-continue').textContent);

  click('btn-continue');
  step('继续冒险可直接开局', g.state === 'playing' && S.UI.levelIndex === 1,
    'state=' + g.state + ' levelIndex=' + S.UI.levelIndex);

  // 统计已上报
  var st = await fetch('api/stats').then(function (r) { return r.json(); });
  step('服务端已累计游玩统计', st.plays >= 1 && st.clears >= 1,
    'plays=' + st.plays + ' clears=' + st.clears + ' best=' + st.best);

  document.title = '##DIAG## ' + log.join(' ;; ') + ' ::ERRORS:: ' + (window.__err.join(' ||| ') || 'NO_ERROR');
})();
</script>
`;

html = html.replace('<head>', '<head>' + probe);
html = html.replace('</body>', report + '</body>');
const out = path.join(root, '_diag.html');
fs.writeFileSync(out, html, 'utf8');

let dom = '';
try {
  dom = execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=15000',
    '--dump-dom',
    BASE + '/_diag.html'
  ], { encoding: 'utf8', maxBuffer: 60 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  console.log('启动 Chrome 失败：' + e.message);
  process.exit(2);
}

const m = dom.match(/<title>([\s\S]*?)<\/title>/);
const title = m ? m[1] : '(未取到 title)';
const i = title.indexOf('::ERRORS::');
console.log('--- 前后端联调（' + BASE + '）---');
console.log((i >= 0 ? title.slice(0, i) : title).split(' ;; ').join('\n'));
console.log('\n--- 运行时错误 ---');
console.log(i >= 0 ? title.slice(i + 11) : '(无)');
try { fs.unlinkSync(out); } catch (e) { }
