/* 实体：碰撞辅助、玩家、敌人、金币、道具、投射物、粒子 */
(function (S) {
  const TILE = S.TILE, T = S.T, ROWS = S.ROWS;

  /* ---------- 瓦片碰撞 ---------- */
  S.tileSolid = function (level, c, r) {
    if (r < 0) return false;
    if (r >= ROWS) return false;
    if (c < 0 || c >= level.w) return true; // 关卡左右边界当墙
    return S.SOLID[level.tiles[r][c]] === true;
  };

  S.resolveX = function (e, level) {
    const r0 = Math.floor(e.y / TILE), r1 = Math.floor((e.y + e.h - 0.01) / TILE);
    if (e.vx > 0) {
      const c = Math.floor((e.x + e.w - 0.01) / TILE);
      for (let r = r0; r <= r1; r++) {
        if (S.tileSolid(level, c, r)) { e.x = c * TILE - e.w - 0.01; e.vx = 0; return true; }
      }
    } else if (e.vx < 0) {
      const c = Math.floor(e.x / TILE);
      for (let r = r0; r <= r1; r++) {
        if (S.tileSolid(level, c, r)) { e.x = (c + 1) * TILE + 0.01; e.vx = 0; return true; }
      }
    }
    return false;
  };

  S.resolveY = function (e, level) {
    const c0 = Math.floor((e.x + 1) / TILE), c1 = Math.floor((e.x + e.w - 1) / TILE);
    let hit = null;
    if (e.vy > 0) {
      const r = Math.floor((e.y + e.h - 0.01) / TILE);
      for (let c = c0; c <= c1; c++) {
        if (S.tileSolid(level, c, r)) { e.y = r * TILE - e.h - 0.01; e.vy = 0; e.onGround = true; hit = { c: c, r: r, dir: 1 }; break; }
      }
    } else if (e.vy < 0) {
      const r = Math.floor(e.y / TILE);
      for (let c = c0; c <= c1; c++) {
        if (S.tileSolid(level, c, r)) { e.y = (r + 1) * TILE + 0.01; e.vy = 0; hit = { c: c, r: r, dir: -1 }; break; }
      }
    }
    return hit;
  };

  /* ---------- 玩家 ---------- */
  function Player(ch, x, y) {
    this.ch = ch;
    this.w = 24; this.h = 46;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.jumps = 0;
    this.inv = 0;         // 受伤无敌
    this.shieldT = 0;     // 正男护盾
    this.dashT = 0;       // 风间冲刺
    this.hoverT = 0;      // 阿呆滑翔
    this.starT = 0;       // 无敌星
    this.cd = 0;
    this.cdMax = ch.skill.cd;
    this.hurtT = 0;
    this.dead = false;
    this.deadT = 0;
    this.animT = 0;
  }
  S.Player = Player;

  S.drawPlayer = function (g, p) {
    S.drawCharacter(g, p.ch, {
      x: p.x + p.w / 2,
      y: p.y + p.h,
      facing: p.facing,
      moving: Math.abs(p.vx) > 25 && p.onGround,
      air: !p.onGround,
      t: p.animT,
      hurt: p.hurtT > 0,
      invincible: p.inv > 0 || p.starT > 0
    });
    if (p.shieldT > 0) { // 护盾光罩
      g.save();
      g.strokeStyle = 'rgba(90,180,255,.85)';
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(p.x + p.w / 2, p.y + p.h / 2, 22, 30, 0, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(90,180,255,.16)';
      g.fill();
      g.restore();
    }
    if (p.starT > 0) { // 无敌星环绕
      g.save();
      g.fillStyle = '#ffd166';
      for (let i = 0; i < 3; i++) {
        const a = p.animT * 6 + i * 2.1;
        S.star(g, p.x + p.w / 2 + Math.cos(a) * 26, p.y + p.h / 2 + Math.sin(a) * 14, 5, 2.4, p.animT + i);
      }
      g.restore();
    }
  };

  S.star = function (g, cx, cy, r, r2, rot) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r2 : r;
      const a = (i / 10) * Math.PI * 2 + rot;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.fill();
  };

  /* ---------- 敌人 ---------- */
  const ENEMY_CFG = {
    ghost: { color: '#9b6bd6', speed: 54, flying: false },
    slime: { color: '#5fbf6a', speed: 66, flying: false },
    ninja: { color: '#3a3d58', speed: 82, flying: true }
  };

  function Enemy(d) {
    const cfg = ENEMY_CFG[d.type] || ENEMY_CFG.ghost;
    this.type = d.type;
    this.cfg = cfg;
    this.w = 34; this.h = 32;
    this.x = d.x; this.y = d.y;
    this.baseY = d.y;
    this.vx = (d.dir || -1) * cfg.speed;
    this.vy = 0;
    this.flying = cfg.flying;
    this.dead = false;
    this.deadT = 0;
    this.onGround = false;
    this.t = Math.random() * 6;
  }
  S.Enemy = Enemy;

  Enemy.prototype.update = function (dt, level) {
    this.t += dt;
    if (this.dead) { this.deadT += dt; return; }

    if (this.flying) {
      this.x += this.vx * dt;
      this.y = this.baseY + Math.sin(this.t * 2.4) * 26;
      if (S.resolveX(this, level)) this.vx *= -1;
    } else {
      this.vy += 1800 * dt;
      this.x += this.vx * dt;
      if (S.resolveX(this, level)) this.vx *= -1;
      this.y += this.vy * dt;
      const hit = S.resolveY(this, level);
      if (hit && hit.dir === 1) {
        // 走到平台边缘则折返（避免掉落）
        const aheadC = Math.floor((this.x + (this.vx > 0 ? this.w + 4 : -4)) / TILE);
        const belowR = Math.floor((this.y + this.h + 6) / TILE);
        if (!S.tileSolid(level, aheadC, belowR)) this.vx *= -1;
      }
    }
  };

  Enemy.prototype.draw = function (g) {
    const t = this.t;
    if (this.dead) {
      const k = Math.min(1, this.deadT / 0.35);
      g.save();
      g.globalAlpha = 1 - k;
      g.translate(this.x + this.w / 2, this.y + this.h);
      g.scale(1 + k * 0.7, 1 - k * 0.8);
      g.translate(-this.w / 2, -this.h);
      drawEnemyBody(g, this, t);
      g.restore();
      return;
    }
    g.save();
    g.translate(this.x, this.y);
    drawEnemyBody(g, this, t);
    g.restore();
  };

  function drawEnemyBody(g, e, t) {
    const c = e.cfg.color;
    const w = e.w, h = e.h;
    if (e.type === 'ghost') {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(2, h);
      g.quadraticCurveTo(0, 4, w / 2, 2);
      g.quadraticCurveTo(w, 4, w - 2, h);
      g.closePath(); g.fill();
      g.fillStyle = c;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(4 + i * 12, h - 2 + Math.sin(t * 6 + i) * 2, 6, Math.PI, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(11, 13, 6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(24, 13, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#22303f';
      g.beginPath(); g.arc(12 + (e.vx > 0 ? 1.6 : -1.6), 14, 3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(25 + (e.vx > 0 ? 1.6 : -1.6), 14, 3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#22303f'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.arc(w / 2, 22, 4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    } else if (e.type === 'slime') {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(1, h - 1);
      g.quadraticCurveTo(0, 2, w / 2, 1);
      g.quadraticCurveTo(w, 2, w - 1, h - 1);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.28)';
      g.beginPath(); g.ellipse(w / 2 - 5, 9, 7, 4.5, -0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(12, 15, 5.6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(23, 15, 5.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#22303f';
      g.beginPath(); g.arc(12 + (e.vx > 0 ? 1.4 : -1.4), 16, 2.8, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(23 + (e.vx > 0 ? 1.4 : -1.4), 16, 2.8, 0, Math.PI * 2); g.fill();
    } else { // ninja（飞行）
      const flap = Math.sin(t * 12) * 6;
      g.fillStyle = '#8c93b8';
      g.beginPath();
      g.moveTo(-2, 12); g.quadraticCurveTo(-16, 6 - flap, -22, 16 - flap); g.quadraticCurveTo(-10, 18, -2, 20);
      g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(w + 2, 12); g.quadraticCurveTo(w + 16, 6 - flap, w + 22, 16 - flap); g.quadraticCurveTo(w + 10, 18, w + 2, 20);
      g.closePath(); g.fill();
      g.fillStyle = c;
      S.roundRect(g, 3, 4, w - 6, h - 6, 10); g.fill();
      g.fillStyle = '#f2f2f2';
      S.roundRect(g, 6, 12, w - 12, 9, 4); g.fill();
      g.fillStyle = '#ff5c5c';
      g.beginPath(); g.arc(12, 16.5, 2.6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(22, 16.5, 2.6, 0, Math.PI * 2); g.fill();
    }
  }

  /* ---------- 金币 ---------- */
  function Coin(x, y) {
    this.x = x; this.y = y; this.w = 24; this.h = 24;
    this.t = Math.random() * 6;
    this.taken = false;
  }
  S.Coin = Coin;
  Coin.prototype.draw = function (g) {
    this.t += 1 / 60;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const sx = Math.abs(Math.cos(this.t * 3));
    g.save();
    g.translate(cx, cy);
    g.scale(Math.max(0.15, sx), 1);
    g.fillStyle = '#f2b705';
    g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd950';
    g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a5a00';
    g.font = 'bold 13px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('★', 0, 1);
    g.restore();
  };

  /* ---------- 道具 ---------- */
  function Item(type, x, y) {
    this.type = type; // star | heart
    this.x = x; this.y = y; this.w = 30; this.h = 30;
    this.vx = type === 'star' ? 90 : 70;
    this.vy = -180;
    this.life = 0;
    this.pop = 0.45;  // 出块动画
    this.dead = false;
  }
  S.Item = Item;
  Item.prototype.update = function (dt, level) {
    if (this.pop > 0) { this.pop -= dt; this.y -= 40 * dt; return; }
    this.life += dt;
    this.vy += 1500 * dt;
    this.x += this.vx * dt;
    if (S.resolveX(this, level)) this.vx *= -1;
    this.y += this.vy * dt;
    const hit = S.resolveY(this, level);
    if (hit && hit.dir === 1 && this.type === 'star') this.vy = -420;
  };
  Item.prototype.draw = function (g) {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    if (this.type === 'star') {
      g.fillStyle = '#ffd166';
      S.star(g, cx, cy, 15, 7, this.life * 3);
      g.fillStyle = '#fff59d';
      S.star(g, cx, cy, 9, 4, this.life * 3);
    } else {
      g.fillStyle = '#ff5c7a';
      g.beginPath();
      g.moveTo(cx, cy + 13);
      g.bezierCurveTo(cx - 18, cy - 2, cx - 8, cy - 16, cx, cy - 6);
      g.bezierCurveTo(cx + 8, cy - 16, cx + 18, cy - 2, cx, cy + 13);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)';
      g.beginPath(); g.ellipse(cx - 5, cy - 4, 4, 3, -0.5, 0, Math.PI * 2); g.fill();
    }
  };

  /* ---------- 投射物 ---------- */
  function Projectile(kind, x, y, facing) {
    this.kind = kind;
    this.facing = facing;
    this.dead = false;
    this.t = 0;
    if (kind === 'beam') {
      this.w = 46; this.h = 30; this.x = x; this.y = y;
      this.vx = 620 * facing; this.vy = 0; this.life = 1.1;
    } else { // bunny
      this.w = 28; this.h = 28; this.x = x; this.y = y;
      this.vx = 330 * facing; this.vy = -300; this.life = 2.2;
    }
  }
  S.Projectile = Projectile;
  Projectile.prototype.update = function (dt) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    this.x += this.vx * dt;
    if (this.kind === 'bunny') {
      this.vy += 1300 * dt;
      this.y += this.vy * dt;
    }
  };
  Projectile.prototype.draw = function (g) {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    if (this.kind === 'beam') {
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, this.life / 0.4));
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = ['#fff3b0', '#ffd166', '#ff9f43'][i];
        g.lineWidth = 8 - i * 2.2;
        g.beginPath();
        g.arc(cx - this.facing * 6, cy, 10 + i * 5, -Math.PI / 2.6, Math.PI / 2.6);
        g.stroke();
      }
      g.fillStyle = '#fff';
      S.star(g, cx + this.facing * 12, cy, 6, 3, this.t * 8);
      g.restore();
    } else {
      g.save();
      g.translate(cx, cy);
      g.rotate(this.t * (this.vx > 0 ? 5 : -5));
      g.fillStyle = '#f7f2ea';
      S.roundRect(g, -11, -8, 22, 18, 8); g.fill();
      g.fillStyle = '#f7f2ea';
      [-5, 5].forEach(function (ox) {
        g.beginPath(); g.ellipse(ox, -15, 3.4, 8, ox > 0 ? 0.2 : -0.2, 0, Math.PI * 2); g.fill();
      });
      g.fillStyle = '#ffb6c8';
      [-5, 5].forEach(function (ox) {
        g.beginPath(); g.ellipse(ox, -14, 1.5, 5, ox > 0 ? 0.2 : -0.2, 0, Math.PI * 2); g.fill();
      });
      g.fillStyle = '#22303f';
      g.beginPath(); g.arc(-4, -2, 1.8, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(4, -2, 1.8, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  };

  /* ---------- 粒子 ---------- */
  function Particle(x, y, vx, vy, color, size, life) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.size = size || 4;
    this.life = life || 0.6; this.max = this.life;
    this.dead = false;
  }
  S.Particle = Particle;
  Particle.prototype.update = function (dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  };
  Particle.prototype.draw = function (g) {
    g.globalAlpha = Math.max(0, this.life / this.max);
    g.fillStyle = this.color;
    g.fillRect(this.x, this.y, this.size, this.size);
    g.globalAlpha = 1;
  };

  S.spawnBurst = function (list, x, y, color, n, spread) {
    for (let i = 0; i < n; i++) {
      list.push(new Particle(
        x, y,
        (Math.random() - 0.5) * (spread || 200),
        -Math.random() * 260 - 40,
        color, 3 + Math.random() * 4, 0.4 + Math.random() * 0.4
      ));
    }
  };
})(window.SHIN);
