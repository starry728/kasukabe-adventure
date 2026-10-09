/* 关卡：主题配置 + 种子化生成 + 背景与瓦片绘制 */
(function (S) {
  const TILE = S.TILE, ROWS = S.ROWS, T = S.T;
  const VIEW_W = S.VIEW_W, VIEW_H = S.VIEW_H;

  S.THEMES = {
    street: {
      name: '春日部街道',
      sky: ['#7ec8f2', '#d8f1ff'],
      sun: '#ffd84d',
      far: '#8fc96a', far2: '#6fae52',
      mid: '#57a34a', groundTop: '#7fd14a', groundBody: '#c98a4b', groundDark: '#a26c38',
      brick: '#c96a3a', stone: '#a8a29b'
    },
    school: {
      name: '幼稚园屋顶',
      sky: ['#ffa95c', '#ffe9b8'],
      sun: '#ff7a4d',
      far: '#d98f5a', far2: '#b96f42',
      mid: '#c2603c', groundTop: '#e8754a', groundBody: '#a94f34', groundDark: '#82381f',
      brick: '#b8532f', stone: '#9d9187'
    },
    stage: {
      name: '动感超人片场',
      sky: ['#241a4a', '#6b3fa0'],
      sun: '#f2f0ff',
      far: '#3a2a66', far2: '#2a1e4d',
      mid: '#4a3a80', groundTop: '#6b6f96', groundBody: '#3a3d58', groundDark: '#262840',
      brick: '#7a5fa8', stone: '#565b7d'
    }
  };

  S.LEVELS = [
    { name: '春日部街道', theme: 'street', seed: 20240917, width: 220, ground: 9, enemyDensity: 0.5, spikeDensity: 0.22, enemyTypes: ['ghost'], time: 320 },
    { name: '幼稚园屋顶', theme: 'school', seed: 77341, width: 240, ground: 8, enemyDensity: 0.62, spikeDensity: 0.38, enemyTypes: ['ghost', 'slime'], time: 300 },
    { name: '动感超人片场', theme: 'stage', seed: 555001, width: 260, ground: 9, enemyDensity: 0.62, spikeDensity: 0.42, enemyTypes: ['slime', 'ninja'], time: 300 }
  ];

  function hash(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

  function fillCol(tiles, col, top, val) {
    for (let r = top; r < ROWS; r++) tiles[r][col] = val;
  }
  function fillGround(tiles, from, to, top) {
    for (let c = from; c < to; c++) fillCol(tiles, c, top, T.GROUND);
  }

  S.generateLevel = function (idx) {
    const cfg = S.LEVELS[idx];
    const rnd = S.mulberry32(cfg.seed);
    const w = cfg.width, h = ROWS;
    const tiles = [];
    for (let r = 0; r < h; r++) tiles.push(new Array(w).fill(T.EMPTY));

    const coins = [], enemies = [], decor = [];
    let groundRow = cfg.ground;
    let x = 0;
    let lastWasGap = false;

    fillGround(tiles, 0, 12, groundRow);
    x = 12;

    while (x < w - 18) {
      // 坑洞后必须接平地，避免连续空洞形成无法跳过的深坑
      const roll = lastWasGap ? 1 : rnd();
      lastWasGap = false;
      if (roll < 0.20) {                       // 坑洞（2~3 格，跳跃距离约 4 格）
        x += 2 + (rnd() < 0.3 ? 1 : 0);
        lastWasGap = true;
      } else if (roll < 0.36) {                // 阶梯（每次 1 格，最多连续 2 格）
        const up = rnd() < 0.5;
        const n = 1 + (rnd() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          groundRow = S.clamp(groundRow + (up ? -1 : 1), 5, ROWS - 3);
          fillGround(tiles, x, x + 2, groundRow);
          x += 2;
        }
      } else if (roll < 0.53) {                // 悬浮砖块平台
        const platY = groundRow - (3 + (rnd() < 0.35 ? 1 : 0));
        const pw = 3 + Math.floor(rnd() * 3);
        fillGround(tiles, x, x + pw + 1, groundRow);   // 平台下方必须有连续地面
        for (let i = 0; i < pw; i++) tiles[platY][x + i] = rnd() < 0.35 ? T.QUESTION : T.BRICK;
        for (let i = 0; i < pw; i++) if (rnd() < 0.65) coins.push({ x: (x + i) * TILE + 8, y: (platY - 1) * TILE + 4 });
        x += pw + 1;
      } else {                                 // 平地段
        const seg = 4 + Math.floor(rnd() * 5);
        fillGround(tiles, x, x + seg, groundRow);

        if (rnd() < 0.55) {
          const by = groundRow - 4;
          const bx = x + 1 + Math.floor(rnd() * 2);
          const cnt = 2 + Math.floor(rnd() * 2);
          for (let i = 0; i < cnt; i++) tiles[by][bx + i] = rnd() < 0.4 ? T.QUESTION : T.BRICK;
        }
        if (rnd() < 0.7) {
          const cx = x + 2, cy = groundRow - 3;
          for (let i = 0; i < 3; i++) coins.push({ x: (cx + i) * TILE + 8, y: cy * TILE + 6 });
        }
        const ecount = rnd() < cfg.enemyDensity ? (rnd() < 0.28 ? 2 : 1) : 0;
        for (let i = 0; i < ecount; i++) {
          const ex = (x + 1 + Math.floor(rnd() * Math.max(1, seg - 2))) * TILE + 4;
          const type = S.pick(cfg.enemyTypes, rnd);
          const flying = type === 'ninja';
          enemies.push({
            type: type,
            x: ex,
            y: flying ? (groundRow - 4) * TILE : groundRow * TILE - 32,
            dir: rnd() < 0.5 ? -1 : 1
          });
        }
        if (rnd() < cfg.spikeDensity && seg > 5) {
          const sx = x + 2 + Math.floor(rnd() * (seg - 4)); // 距段两端至少 2 列
          const nearEnemy = enemies.some(function (e) { return Math.abs(e.x / TILE - sx) < 3.5; });
          if (!nearEnemy) tiles[groundRow - 1][sx] = T.SPIKE;
        }
        x += seg;
      }
    }

    // 终点区
    fillGround(tiles, x, w, groundRow);
    const flagCol = w - 6;
    for (let r = groundRow - 6; r < groundRow; r++) tiles[r][flagCol] = T.FLAG;

    // 安全性清理：地面段顶行（用于识别坑洞）
    const groundTop = function (c) {
      if (c < 0 || c >= w) return -1;
      let r = ROWS - 1;
      if (!S.SOLID[tiles[r][c]]) return -1;
      while (r > 0 && S.SOLID[tiles[r - 1][c]]) r--;
      return r;
    };
    // 1) 尖刺不能紧邻坑洞，否则跳过尖刺必落坑
    // 2) 坑洞上方及两侧 2 格内不放悬空砖块，避免高跳角色撞头后掉坑
    for (let c = 0; c < w; c++) {
      if (groundTop(c) !== -1) continue;
      for (let d = -2; d <= 2; d++) {
        const cc = c + d;
        if (cc < 0 || cc >= w) continue;
        for (let r = 0; r < ROWS - 2; r++) {
          if (tiles[r][cc] === T.SPIKE) tiles[r][cc] = T.EMPTY;
          if (d >= -1 && d <= 1 && (tiles[r][cc] === T.BRICK || tiles[r][cc] === T.QUESTION)) tiles[r][cc] = T.EMPTY;
        }
      }
    }

    // 背景装饰
    for (let i = 0; i < Math.floor(w / 6); i++) {
      decor.push({ x: i * 6 * TILE + hash(i * 3.7) * 180, kind: Math.floor(hash(i * 9.1) * 3), s: 0.8 + hash(i * 5.5) * 0.5 });
    }

    return {
      index: idx, cfg: cfg, theme: S.THEMES[cfg.theme], themeKey: cfg.theme,
      w: w, h: h, tiles: tiles,
      pxW: w * TILE, pxH: h * TILE,
      baseGround: cfg.ground, endGround: groundRow,
      spawn: { x: 3 * TILE, y: cfg.ground * TILE },
      flagX: flagCol * TILE,
      coins: coins, enemies: enemies, decor: decor
    };
  };

  /* ---------------- 背景 ---------------- */
  S.drawBackground = function (g, level, camX, t) {
    const th = level.theme, key = level.themeKey;
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, th.sky[0]);
    grad.addColorStop(1, th.sky[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    const horizon = (level.baseGround - 1) * TILE;

    // 太阳 / 月亮
    g.save();
    g.fillStyle = th.sun;
    g.globalAlpha = key === 'stage' ? 0.9 : 0.95;
    g.beginPath(); g.arc(VIEW_W - 130, 90, 38, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.18;
    g.beginPath(); g.arc(VIEW_W - 130, 90, 62, 0, Math.PI * 2); g.fill();
    g.restore();
    if (key === 'stage') { // 月亮缺口
      g.fillStyle = th.sky[0];
      g.beginPath(); g.arc(VIEW_W - 112, 78, 34, 0, Math.PI * 2); g.fill();
    }

    if (key === 'stage') { // 星星
      for (let i = 0; i < 46; i++) {
        const sx = (hash(i) * VIEW_W * 1.6 - camX * 0.08) % (VIEW_W + 40);
        const sy = hash(i * 2.3) * 230 + 10;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
        g.fillStyle = 'rgba(255,255,255,' + tw.toFixed(2) + ')';
        g.fillRect((sx + VIEW_W + 40) % (VIEW_W + 40) - 20, sy, 2.4, 2.4);
      }
    } else { // 云
      for (let i = 0; i < 7; i++) {
        const cx = ((i * 340 - camX * 0.22) % (VIEW_W + 340) + VIEW_W + 340) % (VIEW_W + 340) - 170;
        const cy = 60 + hash(i * 4.4) * 110;
        const s = 0.7 + hash(i * 7.7) * 0.7;
        g.fillStyle = 'rgba(255,255,255,.9)';
        g.beginPath();
        g.arc(cx, cy, 22 * s, 0, Math.PI * 2);
        g.arc(cx + 26 * s, cy + 6 * s, 17 * s, 0, Math.PI * 2);
        g.arc(cx - 26 * s, cy + 7 * s, 15 * s, 0, Math.PI * 2);
        g.fill();
      }
    }

    // 远景（视差 0.15）
    const fx = -camX * 0.15;
    g.fillStyle = th.far;
    if (key === 'street') {
      for (let i = -1; i < 8; i++) {
        const bx = fx + i * 300;
        g.beginPath();
        g.moveTo(bx - 150, horizon);
        g.lineTo(bx - 60, horizon - 120);
        g.lineTo(bx + 40, horizon - 40);
        g.lineTo(bx + 150, horizon);
        g.closePath(); g.fill();
      }
    } else if (key === 'school') {
      g.fillStyle = th.far2;
      for (let i = -1; i < 8; i++) {
        const bx = fx + i * 320;
        g.fillRect(bx, horizon - 150, 200, 190);
        g.fillStyle = th.far;
        g.beginPath(); g.moveTo(bx - 16, horizon - 150); g.lineTo(bx + 100, horizon - 210); g.lineTo(bx + 216, horizon - 150); g.closePath(); g.fill();
        g.fillStyle = th.far2;
      }
    } else {
      for (let i = -1; i < 9; i++) {
        const bx = fx + i * 260;
        g.fillRect(bx, horizon - 190, 120, 230);
        g.fillStyle = th.far2;
        g.fillRect(bx + 20, horizon - 160, 30, 60);
        g.fillRect(bx + 70, horizon - 160, 30, 60);
        g.fillStyle = th.far;
      }
    }

    // 中景装饰（视差 0.45）
    const mx = -camX * 0.45;
    level.decor.forEach(function (d, i) {
      const x = d.x + mx;
      if (x < -140 || x > VIEW_W + 140) return;
      if (key === 'street') {
        if (d.kind === 0) { // 树
          g.fillStyle = '#8b5a3c';
          g.fillRect(x + 16 * d.s, horizon - 60 * d.s, 8 * d.s, 62 * d.s);
          g.fillStyle = th.mid;
          g.beginPath(); g.arc(x + 20 * d.s, horizon - 66 * d.s, 30 * d.s, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(x - 6 * d.s, horizon - 50 * d.s, 22 * d.s, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(x + 46 * d.s, horizon - 52 * d.s, 22 * d.s, 0, Math.PI * 2); g.fill();
        } else if (d.kind === 1) { // 房子
          g.fillStyle = '#f2e2c4';
          g.fillRect(x, horizon - 90 * d.s, 90 * d.s, 92 * d.s);
          g.fillStyle = '#c05746';
          g.beginPath(); g.moveTo(x - 10 * d.s, horizon - 90 * d.s); g.lineTo(x + 45 * d.s, horizon - 132 * d.s); g.lineTo(x + 100 * d.s, horizon - 90 * d.s); g.closePath(); g.fill();
          g.fillStyle = '#8fc4e8';
          g.fillRect(x + 18 * d.s, horizon - 66 * d.s, 22 * d.s, 22 * d.s);
          g.fillRect(x + 54 * d.s, horizon - 66 * d.s, 22 * d.s, 22 * d.s);
        } else { // 邮筒
          g.fillStyle = '#d94f4f';
          S.roundRect(g, x + 10, horizon - 46, 20, 48, 8); g.fill();
        }
      } else if (key === 'school') {
        if (d.kind === 0) { // 栏杆
          g.strokeStyle = '#f2f2f2'; g.lineWidth = 4;
          g.beginPath(); g.moveTo(x, horizon - 40); g.lineTo(x + 120, horizon - 40); g.stroke();
          for (let k = 0; k < 5; k++) {
            g.beginPath(); g.moveTo(x + k * 30, horizon - 42); g.lineTo(x + k * 30, horizon); g.stroke();
          }
        } else if (d.kind === 1) { // 水箱
          g.fillStyle = '#9fb3c8';
          g.fillRect(x, horizon - 70, 60, 72);
          g.fillStyle = '#7d94ab';
          g.fillRect(x - 4, horizon - 78, 68, 10);
        } else { // 滑梯
          g.strokeStyle = '#5fb7c9'; g.lineWidth = 7; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x, horizon - 70); g.quadraticCurveTo(x + 60, horizon - 10, x + 60, horizon); g.stroke();
        }
      } else {
        if (d.kind === 0) { // 探照灯
          g.fillStyle = '#2c2f45';
          g.fillRect(x, horizon - 30, 26, 32);
          const ang = Math.sin(t * 0.6 + i) * 0.5;
          g.save();
          g.translate(x + 13, horizon - 30);
          g.rotate(ang - Math.PI / 2);
          const lg = g.createLinearGradient(0, 0, 0, -260);
          lg.addColorStop(0, 'rgba(255,246,180,.35)');
          lg.addColorStop(1, 'rgba(255,246,180,0)');
          g.fillStyle = lg;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(-42, -250); g.lineTo(42, -250); g.closePath(); g.fill();
          g.restore();
        } else if (d.kind === 1) { // 幕布
          g.fillStyle = '#8c2f4a';
          g.fillRect(x, horizon - 150, 110, 152);
          g.fillStyle = 'rgba(0,0,0,.18)';
          for (let k = 0; k < 6; k++) g.fillRect(x + k * 18, horizon - 150, 9, 152);
        } else { // 摄像机
          g.fillStyle = '#3a3d58';
          g.fillRect(x, horizon - 46, 46, 26);
          g.fillStyle = '#1f2133';
          g.fillRect(x + 40, horizon - 40, 22, 14);
          g.fillStyle = '#ff5c5c';
          g.beginPath(); g.arc(x + 10, horizon - 33, 3.6, 0, Math.PI * 2); g.fill();
        }
      }
    });

    // 地面线以上底色（防止远景透出）
    g.fillStyle = 'rgba(0,0,0,.06)';
    g.fillRect(0, horizon, VIEW_W, VIEW_H - horizon);
  };

  /* ---------------- 瓦片 ---------------- */
  function drawTile(g, kind, x, y, th, t, r, c) {
    switch (kind) {
      case T.GROUND:
        g.fillStyle = th.groundBody;
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = th.groundDark;
        g.fillRect(x + 4, y + 16, 8, 6);
        g.fillRect(x + 24, y + 26, 8, 6);
        break;
      case T.STONE:
        g.fillStyle = th.stone;
        g.fillRect(x, y, TILE, TILE);
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
        g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        break;
      case T.BRICK:
        g.fillStyle = th.brick;
        g.fillRect(x, y, TILE, TILE);
        g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y + 20); g.lineTo(x + TILE, y + 20);
        g.moveTo(x + 20, y); g.lineTo(x + 20, y + 20);
        g.moveTo(x + 10, y + 20); g.lineTo(x + 10, y + TILE);
        g.moveTo(x + 30, y + 20); g.lineTo(x + 30, y + TILE);
        g.stroke();
        break;
      case T.QUESTION: {
        const bob = Math.sin(t * 3 + c) * 1.5;
        g.fillStyle = '#f2b705';
        S.roundRect(g, x + 2, y + 2 + bob, TILE - 4, TILE - 4, 6); g.fill();
        g.fillStyle = '#ffd950';
        S.roundRect(g, x + 6, y + 6 + bob, TILE - 12, TILE - 16, 5); g.fill();
        g.fillStyle = '#8a5a00';
        g.font = 'bold 22px system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('?', x + TILE / 2, y + TILE / 2 + bob);
        break;
      }
      case T.USED:
        g.fillStyle = '#9a7b52';
        S.roundRect(g, x + 2, y + 2, TILE - 4, TILE - 4, 6); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x + 10, y + 10); g.lineTo(x + 30, y + 30); g.stroke();
        g.beginPath(); g.moveTo(x + 30, y + 10); g.lineTo(x + 10, y + 30); g.stroke();
        break;
      case T.SPIKE:
        g.fillStyle = '#dfe6ec';
        g.strokeStyle = '#7a868f'; g.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const sx = x + i * 13 + 1;
          g.beginPath();
          g.moveTo(sx, y + TILE);
          g.lineTo(sx + 6.5, y + 8);
          g.lineTo(sx + 13, y + TILE);
          g.closePath();
          g.fill(); g.stroke();
        }
        break;
      case T.FLAG:
        g.fillStyle = '#cfd6dd';
        g.fillRect(x + 17, y, 6, TILE);
        break;
    }
  }

  S.drawTiles = function (g, level, camX, t) {
    const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const c1 = Math.min(level.w - 1, c0 + Math.ceil(VIEW_W / TILE) + 2);
    const th = level.theme;
    for (let c = c0; c <= c1; c++) {
      for (let r = 0; r < ROWS; r++) {
        const k = level.tiles[r][c];
        if (!k) continue;
        const x = c * TILE, y = r * TILE;
        drawTile(g, k, x, y, th, t, r, c);
        // 草皮表层
        if (k === T.GROUND && (r === 0 || level.tiles[r - 1][c] === T.EMPTY)) {
          g.fillStyle = th.groundTop;
          g.fillRect(x, y, TILE, 9);
          g.fillStyle = 'rgba(255,255,255,.18)';
          g.fillRect(x, y, TILE, 3);
        }
      }
    }
  };

  // 终点旗杆 + 主题建筑
  S.drawGoal = function (g, level, camX, t) {
    const fx = level.flagX, th = level.theme;
    const baseY = level.endGround * TILE;
    const topY = (level.endGround - 6) * TILE;

    // 建筑
    g.fillStyle = th.groundDark;
    g.fillRect(fx + 60, baseY - 120, 110, 122);
    g.fillStyle = th.stone;
    g.fillRect(fx + 92, baseY - 80, 44, 82);
    g.fillStyle = th.brick;
    g.beginPath();
    g.moveTo(fx + 52, baseY - 120);
    g.lineTo(fx + 115, baseY - 168);
    g.lineTo(fx + 178, baseY - 120);
    g.closePath(); g.fill();

    // 杆
    g.fillStyle = '#cfd6dd';
    g.fillRect(fx + 17, topY, 6, baseY - topY);
    g.fillStyle = '#f2f2f2';
    g.beginPath(); g.arc(fx + 20, topY - 4, 7, 0, Math.PI * 2); g.fill();

    // 旗
    const wave = Math.sin(t * 4) * 5;
    g.fillStyle = '#e8453c';
    g.beginPath();
    g.moveTo(fx + 22, topY + 6);
    g.quadraticCurveTo(fx + 52, topY + 14 + wave, fx + 74, topY + 8);
    g.lineTo(fx + 74, topY + 44);
    g.quadraticCurveTo(fx + 52, topY + 50 + wave, fx + 22, topY + 42);
    g.closePath(); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(fx + 48, topY + 26, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8453c';
    g.beginPath(); g.arc(fx + 48, topY + 26, 4.5, 0, Math.PI * 2); g.fill();
  };
})(window.SHIN);
