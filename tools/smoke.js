/* 无头冒烟测试：验证关卡可生成、物理无异常、关卡可通过性 */
const path = require('path');
const base = path.join(__dirname, '..', 'js');

global.window = global;
global.devicePixelRatio = 1;
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;

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

require(path.join(base, 'core.js'));
require(path.join(base, 'characters.js'));
require(path.join(base, 'levels.js'));
require(path.join(base, 'entities.js'));
const S = global.SHIN;

S.Audio = {
  play() {}, speak() { return ''; }, startMusic() {}, stopMusic() {},
  setSfx() {}, setBgm() {}, setVoice() {}, unlock() {}
};
S.Input = {
  down: { left: false, right: false, jump: false, skill: false },
  pressed: { jump: false, skill: false }
};

require(path.join(base, 'engine.js'));

/* ---------- 1. 关卡静态检查 ---------- */
const TILE = S.TILE, ROWS = S.ROWS, T = S.T;
console.log('=== 关卡生成检查 ===');
S.LEVELS.forEach(function (cfg, idx) {
  const lv = S.generateLevel(idx);
  // 地面段顶行（从底部往上找，避开悬浮平台干扰）
  const groundTop = function (c) {
    let r = ROWS - 1;
    if (!S.SOLID[lv.tiles[r][c]]) return -1;
    while (r > 0 && S.SOLID[lv.tiles[r - 1][c]]) r--;
    return r;
  };
  let maxGap = 0, gaps = 0, curGap = 0, maxStep = 0, prevTop = null;
  for (let c = 0; c < lv.w; c++) {
    const top = groundTop(c);
    if (top === -1) { curGap++; maxGap = Math.max(maxGap, curGap); continue; }
    if (curGap > 0) { gaps++; curGap = 0; }
    if (prevTop !== null) maxStep = Math.max(maxStep, Math.abs(top - prevTop));
    prevTop = top;
  }
  // 地面列的可站立顶面（用于计算落差）
  console.log(
    '关卡' + (idx + 1) + ' ' + cfg.name +
    ' | 宽 ' + lv.w + ' 格' +
    ' | 金币 ' + lv.coins.length +
    ' | 敌人 ' + lv.enemies.length +
    ' | 坑洞 ' + gaps + ' 处(最大 ' + maxGap + ' 格)' +
    ' | 相邻落差最大 ' + maxStep + ' 格'
  );
  if (maxGap > 3) console.log('  ⚠ 存在过宽坑洞（跳跃距离约 4 格）');
});

/* ---------- 2. 自动驾驶跑关 ---------- */
function autoRun(levelIndex, charId, maxFrames, opts) {
  opts = opts || {};
  const game = new S.Game({ getContext: () => makeCtx(), width: 0, height: 0 });
  let cleared = false, gameover = false, deaths = 0, err = null;
  game.on.clear = function () { cleared = true; };
  game.on.gameover = function () { gameover = true; };

  game.start(levelIndex, charId);
  const In = S.Input;
  In.down.left = false; In.down.right = true;
  const log = [];
  const trace = [];
  let prevLives = game.lives;

  for (let f = 0; f < maxFrames && !cleared && !gameover; f++) {
    const p = game.player, lv = game.level;
    // 简单 AI：撞墙 / 前方是坑 / 前方有敌人 → 跳
    // 扫描前方 6 列，在坑洞/尖刺边缘起跳
    const gTop = function (c) {
      let r = ROWS - 1;
      if (!S.SOLID[lv.tiles[r][c]]) return -1;
      while (r > 0 && S.SOLID[lv.tiles[r - 1][c]]) r--;
      return r;
    };
    const pc = Math.floor((p.x + p.w) / TILE);
    let dangerX = null;
    for (let d = 0; d <= 6; d++) {
      const c = pc + d;
      if (c >= lv.w) break;
      const top = gTop(c);
      if (top === -1) { dangerX = c * TILE; break; }
      if (top > 0 && lv.tiles[top - 1][c] === S.T.SPIKE) { dangerX = c * TILE; break; }
    }
    let near = null;
    for (const e of game.enemies) {
      if (!e.dead && e.x - p.x > -10 && e.x - p.x < 80 && Math.abs(e.y - p.y) < 60) { near = e; break; }
    }
    let jump = false;
    if (p.onGround) {
      if (Math.abs(p.vx) < 40) jump = true;
      else if (dangerX !== null && dangerX - (p.x + p.w) < 45) jump = true;
      else if (near) jump = true;
    } else if (p.vy > 100 && p.jumps < p.ch.stats.maxJumps &&
               !S.tileSolid(lv, Math.floor((p.x + p.w / 2) / TILE), Math.floor((p.y + p.h + 40) / TILE))) {
      jump = true; // 空中自救二段跳
    }
    if (jump) In.pressed.jump = true;
    In.down.jump = !p.onGround; // 保持按住以获得最大跳跃高度
    if (near && p.cd === 0) In.pressed.skill = true;

    if (opts.trace) {
      if (f % 6 === 0) {
        trace.push(Math.round(p.x / TILE) + ',' + Math.round(p.y / TILE) + (p.onGround ? 'G' : 'A'));
        if (trace.length > 22) trace.shift();
      }
      if (p.y > 460) { trace.push('掉坑@' + Math.round(p.x / TILE) + '格'); break; }
    }
    if (opts.ghost) p.inv = 5; // 无敌模式：只验证地形连通性
    try { game.update(1 / 60); } catch (e) { err = e; break; }
    if (game.state === 'dying') deaths++;
    if (game.lives !== prevLives) {
      prevLives = game.lives;
      log.push('x=' + Math.round(p.x / TILE) + '格 y=' + Math.round(p.y / TILE) + ' 命=' + game.lives);
    }
    In.pressed.jump = false;
    In.pressed.skill = false;
  }
  return {
    cleared: cleared, gameover: gameover, deaths: deaths, err: err, log: log, trace: trace,
    progress: Math.round(game.player.x / game.level.flagX * 100),
    score: game.score, lives: game.lives
  };
}

console.log('\n=== 自动驾驶测试（每关最多 90 秒模拟）===');
S.CHARACTERS.forEach(function (ch) {
  const r = autoRun(0, ch.id, 5400);
  console.log(
    ch.nick.padEnd(4, '　') +
    ' | ' + (r.cleared ? '通关 ✔' : (r.gameover ? '失败 ✘' : '未跑完')) +
    ' | 进度 ' + r.progress + '%' +
    ' | 死亡 ' + r.deaths + ' 次' +
    ' | 得分 ' + r.score +
    ' | 剩余命 ' + r.lives +
    (r.err ? ' | 异常: ' + r.err.message : '') +
    (r.log.length ? '\n    掉命点: ' + r.log.join(' / ') : '')
  );
});

/* ---------- 3. 渲染冒烟：跑遍所有绘制路径 ---------- */
console.log('\n=== 渲染冒烟（角色/技能/道具/三套主题）===');
S.CHARACTERS.forEach(function (ch) {
  const game = new S.Game({ getContext: () => makeCtx(), width: 0, height: 0 });
  let err = null;
  try {
    game.start(0, ch.id);
    game.player.starT = 5;
    game.player.shieldT = 2;
    game.projectiles.push(new S.Projectile('beam', 200, 300, 1));
    game.projectiles.push(new S.Projectile('bunny', 240, 300, -1));
    game.items.push(new S.Item('star', 300, 300));
    game.items.push(new S.Item('heart', 340, 300));
    game.useSkill();
    for (let i = 0; i < 180; i++) { game.update(1 / 60); game.render(); }
    game.die();
    for (let i = 0; i < 120; i++) { game.update(1 / 60); game.render(); }
  } catch (e) { err = e; }
  console.log(ch.nick.padEnd(4, '　') + ' 渲染 ' + (err ? '✘ ' + err.message : '✔'));
});
[1, 2].forEach(function (li) {
  const game = new S.Game({ getContext: () => makeCtx(), width: 0, height: 0 });
  let err = null;
  try {
    game.start(li, 'shin');
    for (let i = 0; i < 240; i++) { game.update(1 / 60); game.render(); }
  } catch (e) { err = e; }
  console.log(S.LEVELS[li].name + ' 渲染 ' + (err ? '✘ ' + err.message : '✔'));
});
// 诊断项（非断言）：无敌 AI 的首次坠落点，供关卡调参参考。通关判定以上方「自动驾驶测试」为准。
console.log('\n=== 坠落点诊断（仅调参参考，非通过/失败判定）===');
for (let i = 0; i < S.LEVELS.length; i++) {
  const r = autoRun(i, 'shin', 7200, { ghost: true, trace: true });
  console.log('关卡' + (i + 1) + '：AI 首次坠落位置 ' + r.progress + '%' +
    (r.cleared ? '（仍通关 ✔）' : '') + (r.err ? ' | 异常: ' + r.err.message : ''));
  if (r.trace.length) console.log('    末段轨迹(格,行,G地面/A空中): ' + r.trace.join(' '));
}
