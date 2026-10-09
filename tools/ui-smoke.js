/* DOM 层冒烟：用 jsdom 跑通 UI 初始化与点击流程 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
const win = dom.window;

// canvas 上下文 mock
function makeCtx() {
  const noop = () => {};
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k === 'createLinearGradient') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 10 });
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
win.HTMLCanvasElement.prototype.getContext = () => makeCtx();

const files = ['core', 'audio', 'characters', 'levels', 'entities', 'engine', 'input', 'api', 'ui', 'main'];
files.forEach(function (f) {
  win.eval(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'));
});

// 等待 DOMContentLoaded（jsdom 异步触发 boot）
setTimeout(run, 150);

function run() {
const S = win.SHIN;
const doc = win.document;
const results = [];
function check(name, cond, extra) {
  results.push((cond ? '✔ ' : '✘ ') + name + (extra ? ' → ' + extra : ''));
}

check('脚本加载完成，SHIN.UI 就绪', !!S.UI);
check('选人卡片数量 = 5', doc.querySelectorAll('.char-card').length === 5, doc.querySelectorAll('.char-card').length + ' 张');

// 点击「开始游戏」
doc.getElementById('btn-start').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
check('标题页 → 选人页', !doc.getElementById('screen-select').classList.contains('hidden'));

// 点击第 3 个角色（妮妮）
const cards = doc.querySelectorAll('.char-card');
cards[2].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
check('点击卡片可选中角色', S.UI.charId === 'nene', '当前=' + S.UI.charId);
check('选中卡片高亮', cards[2].classList.contains('active'));

// 开始冒险
doc.getElementById('btn-go').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
const game = S.UI.game;
check('进入游戏，HUD 显示', !doc.getElementById('hud').classList.contains('hidden'));
check('游戏状态 = playing', game.state === 'playing', game.state);
check('角色 = 妮妮', game.ch.id === 'nene');

// 推进 180 帧（含输入模拟）
S.Input.down.right = true;
let uiErr = null;
try {
  for (let i = 0; i < 180; i++) {
    if (i % 40 === 0) S.Input.pressed.jump = true;
    game.update(1 / 60);
    game.render();
    S.UI.updateHud(game);
  }
} catch (e) { uiErr = e; }
check('连续 180 帧更新+渲染+HUD 无异常', !uiErr, uiErr && uiErr.message);
check('HUD 分数已渲染', doc.getElementById('hud-score').textContent !== '', '分数=' + doc.getElementById('hud-score').textContent);
check('HUD 生命显示', doc.getElementById('hud-lives').textContent.length > 0, doc.getElementById('hud-lives').textContent);
check('技能条宽度已设置', /%$/.test(doc.getElementById('skill-fill').style.width), doc.getElementById('skill-fill').style.width);

// 台词气泡
game.say('jump', 0);
check('台词气泡可显示', !doc.getElementById('bubble').classList.contains('hidden'));

// 暂停 / 继续
S.UI.togglePause();
check('可暂停', game.paused && !doc.getElementById('screen-pause').classList.contains('hidden'));
S.UI.togglePause();
check('可继续', !game.paused && doc.getElementById('screen-pause').classList.contains('hidden'));

// 过关流程
game.emit('clear', game);
check('通关 → 结算页', !doc.getElementById('screen-result').classList.contains('hidden'));
check('结算显示本关得分', doc.getElementById('result-body').innerHTML.indexOf('本关得分') >= 0);
check('最高分写入 localStorage', Number(win.localStorage.getItem('shin-runner-best') || 0) > 0,
  win.localStorage.getItem('shin-runner-best'));

// 下一关
doc.getElementById('btn-next').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
check('下一关：关卡索引 +1 且重新开局', S.UI.levelIndex === 1 && game.state === 'playing', 'levelIndex=' + S.UI.levelIndex);

// 游戏结束流程
game.emit('gameover', game);
check('游戏结束 → 结算页', doc.getElementById('result-title').textContent === '游戏结束');
doc.getElementById('btn-home').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
check('返回标题页', !doc.getElementById('screen-title').classList.contains('hidden'));

console.log(results.join('\n'));
const failed = results.filter(function (r) { return r[0] === '✘'; }).length;
console.log('\n结果：' + (results.length - failed) + ' 通过 / ' + failed + ' 失败');
process.exit(failed ? 1 : 0);
}
