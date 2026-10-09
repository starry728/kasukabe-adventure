/* 游戏引擎：固定步长循环、物理、碰撞、技能、流程状态机 */
(function (S) {
  const TILE = S.TILE, T = S.T, VIEW_W = S.VIEW_W, VIEW_H = S.VIEW_H;
  const FIXED = 1 / 60;

  function Game(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.dpr = 1;
    this.state = 'idle';       // idle | playing | dying | clear | ended
    this.paused = false;
    this.time = 0;
    this.lastT = 0;
    this.acc = 0;
    this.on = {};
    this.lastSay = {};
    this.camX = 0;
    this.setupDPR();
    const self = this;
    this.loopBound = function (ts) { self.loop(ts); };
  }

  Game.prototype.setupDPR = function () {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = VIEW_W * dpr;
    this.canvas.height = VIEW_H * dpr;
  };

  Game.prototype.emit = function (name, data) {
    if (this.on[name]) this.on[name](data);
  };

  Game.prototype.say = function (key, minGap) {
    const now = this.time;
    const gap = minGap == null ? 0.8 : minGap;
    if (this.lastSay[key] && now - this.lastSay[key] < gap) return;
    this.lastSay[key] = now;
    const text = S.Audio.speak(this.player.ch.id, key);
    if (text) this.emit('bubble', text);
  };

  /* ---------- 开局 ---------- */
  Game.prototype.start = function (levelIndex, charId) {
    const ch = S.getCharacter(charId);
    this.ch = ch;
    this.levelIndex = levelIndex;
    this.level = S.generateLevel(levelIndex);
    this.player = new S.Player(ch, this.level.spawn.x, this.level.spawn.y - 46);
    this.coins = this.level.coins.map(function (c) { return new S.Coin(c.x, c.y); });
    this.enemies = this.level.enemies.map(function (d) { return new S.Enemy(d); });
    this.items = [];
    this.projectiles = [];
    this.particles = [];
    this.score = 0;
    this.coinCount = 0;
    this.lives = ch.stats.lives;
    this.timeLeft = this.level.cfg.time;
    this.state = 'playing';
    this.paused = false;
    this.clearT = 0;
    this.deadT = 0;
    this.camX = 0;
    this.time = 0;
    this.lastSay = {};
    this.cpX = this.player.x;   // 复活点（随前进更新）
    this.cpY = this.player.y;
    S.Audio.startMusic(levelIndex);
    this.emit('start', this);
  };

  Game.prototype.restartLevel = function () {
    this.start(this.levelIndex, this.ch.id);
  };

  Game.prototype.setPaused = function (v) {
    if (this.state !== 'playing') { this.paused = false; return; }
    this.paused = !!v;
    if (this.paused) S.Audio.stopMusic();
    else S.Audio.startMusic(this.levelIndex);
  };

  Game.prototype.respawn = function () {
    const p = this.player;
    p.x = this.cpX;
    p.y = this.cpY;
    p.vx = 0; p.vy = 0;
    p.inv = 1.6; p.hurtT = 0; p.starT = 0; p.dashT = 0; p.hoverT = 0;
    p.dead = false; p.deadT = 0;
    this.camX = 0;
    this.state = 'playing';
  };

  /* ---------- 主循环 ---------- */
  Game.prototype.run = function () {
    this.lastT = performance.now() / 1000;
    requestAnimationFrame(this.loopBound);
  };

  Game.prototype.loop = function (ts) {
    requestAnimationFrame(this.loopBound);
    const now = ts / 1000;
    let dt = now - this.lastT;
    this.lastT = now;
    if (dt > 0.25) dt = 0.25;

    if (!this.paused && this.state !== 'idle' && this.state !== 'ended') {
      this.acc += dt;
      let guard = 0;
      while (this.acc >= FIXED && guard++ < 8) {
        this.update(FIXED);
        this.acc -= FIXED;
      }
    }
    if (this.state !== 'idle') this.render();
    this.emit('frame', this);
  };

  /* ---------- 更新 ---------- */
  Game.prototype.update = function (dt) {
    this.time += dt;
    const p = this.player;
    p.animT += dt;

    if (this.state === 'dying') {
      this.deadT += dt;
      p.vy += 1800 * dt;
      p.y += p.vy * dt;
      this.updateParticles(dt);
      if (this.deadT > 1.5) {
        this.state = 'ended';
        S.Audio.stopMusic();
        this.emit('gameover', this);
      }
      return;
    }

    if (this.state === 'clear') {
      this.clearT += dt;
      p.vx = 130;
      p.x += p.vx * dt;
      p.vy += p.ch.stats.gravity * dt;
      p.y += p.vy * dt;
      p.onGround = false;
      S.resolveY(p, this.level);
      this.updateCamera();
      this.updateParticles(dt);
      if (this.clearT > 1.8) {
        this.state = 'ended';
        S.Audio.stopMusic();
        this.emit('clear', this);
      }
      return;
    }

    // 倒计时
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.lives = 0;
      this.die();
      return;
    }

    this.updatePlayer(dt);

    // 实体
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].update(dt, this.level);
    for (let i = 0; i < this.items.length; i++) this.items[i].update(dt, this.level);
    for (let i = 0; i < this.projectiles.length; i++) this.projectiles[i].update(dt);

    this.checkCoins();
    this.checkItems();
    this.checkProjectiles();
    this.checkEnemies();
    this.checkSpikes();
    this.updateParticles(dt);

    // 清理
    this.enemies = this.enemies.filter(function (e) { return !(e.dead && e.deadT > 0.4); });
    this.items = this.items.filter(function (it) { return !it.dead && it.y < VIEW_H + 200; });
    this.projectiles = this.projectiles.filter(function (pr) { return !pr.dead; });

    // 掉出世界
    if (p.y > this.level.pxH + 60) {
      this.lives--;
      S.Audio.play('die');
      this.say('die', 0);
      if (this.lives <= 0) this.die();
      else this.respawn();
      return;
    }

    // 前进过程中记录复活点（站在地面上、且距上个复活点 240px 以上）
    if (p.onGround && p.x - this.cpX > 240) {
      this.cpX = p.x;
      this.cpY = p.y;
    }

    this.updateCamera();

    // 到达终点
    if (p.x + p.w >= this.level.flagX + 16) {
      this.state = 'clear';
      this.clearT = 0;
      this.score += 1000 + Math.floor(this.timeLeft) * 5;
      S.Audio.play('clear');
      this.say('clear', 0);
      S.spawnBurst(this.particles, p.x, p.y, '#ffd166', 26, 320);
    }
  };

  Game.prototype.updateCamera = function () {
    const p = this.player;
    const target = p.x + p.w / 2 - VIEW_W * 0.42;
    this.camX = S.clamp(target, 0, Math.max(0, this.level.pxW - VIEW_W));
  };

  Game.prototype.updateParticles = function (dt) {
    for (let i = 0; i < this.particles.length; i++) this.particles[i].update(dt);
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
    this.particles = this.particles.filter(function (pt) { return !pt.dead; });
  };

  Game.prototype.updatePlayer = function (dt) {
    const p = this.player, st = p.ch.stats, In = S.Input;
    const maxSp = st.speed * (p.dashT > 0 ? 1.85 : 1) * (p.starT > 0 ? 1.2 : 1);
    const dir = (In.down.right ? 1 : 0) - (In.down.left ? 1 : 0);

    if (dir !== 0) {
      p.vx += dir * (p.onGround ? 2400 : 1600) * dt;
      p.facing = dir;
    } else {
      const f = (p.onGround ? 1900 : 800) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    p.vx = S.clamp(p.vx, -maxSp, maxSp);

    // 跳跃（含二段跳 + 可变高度）
    if (In.pressed.jump) {
      In.pressed.jump = false;
      if (p.onGround) {
        p.vy = -st.jump;
        p.jumps = 1;
        p.onGround = false;
        S.Audio.play('jump');
        this.say('jump', 1.2);
      } else if (p.jumps < st.maxJumps) {
        p.vy = -st.jump * 0.92;
        p.jumps++;
        S.Audio.play('jump');
        S.spawnBurst(this.particles, p.x + p.w / 2, p.y + p.h, '#ffffff', 6, 120);
      }
    }
    if (!In.down.jump && p.vy < 0) p.vy += 2600 * dt;

    if (In.pressed.skill) { In.pressed.skill = false; this.useSkill(); }

    // 计时器
    if (p.inv > 0) p.inv -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.cd > 0) p.cd = Math.max(0, p.cd - dt);
    if (p.starT > 0) p.starT -= dt;
    if (p.dashT > 0) {
      p.dashT -= dt;
      if (Math.random() < 0.5) S.spawnBurst(this.particles, p.x + p.w / 2, p.y + p.h - 6, '#8cd0ff', 2, 90);
    }
    if (p.shieldT > 0) p.shieldT -= dt;
    if (p.hoverT > 0) p.hoverT -= dt;

    // 重力
    let g = st.gravity;
    if (p.hoverT > 0 && p.vy > 0) g *= 0.32;
    p.vy = Math.min(p.vy + g * dt, 1250);

    // 位移 + 碰撞
    p.x += p.vx * dt;
    S.resolveX(p, this.level);
    p.y += p.vy * dt;
    p.onGround = false;
    const hit = S.resolveY(p, this.level);
    if (hit && hit.dir === -1) this.bumpBlock(hit.c, hit.r);
    if (p.onGround) p.jumps = 0;
  };

  Game.prototype.useSkill = function () {
    const p = this.player, s = p.ch.skill;
    if (p.cd > 0) return;
    p.cd = s.cd;
    switch (s.id) {
      case 'beam':
        this.projectiles.push(new S.Projectile('beam', p.x + (p.facing > 0 ? p.w : -46), p.y + 8, p.facing));
        break;
      case 'dash':
        p.dashT = 1.4;
        p.inv = Math.max(p.inv, 1.4);
        S.spawnBurst(this.particles, p.x + p.w / 2, p.y + p.h / 2, '#8cd0ff', 14, 220);
        break;
      case 'bunny':
        this.projectiles.push(new S.Projectile('bunny', p.x + p.w / 2 - 14, p.y + 6, p.facing));
        break;
      case 'shield':
        p.shieldT = 3.5;
        break;
      case 'snot':
        p.hoverT = 1.3;
        p.vy = Math.min(p.vy, -p.ch.stats.jump * 0.82);
        p.jumps = Math.max(p.jumps, 1);
        S.spawnBurst(this.particles, p.x + p.w / 2, p.y + 4, '#bfe6ff', 10, 160);
        break;
    }
    S.Audio.play('skill');
    this.say('skill', 0.6);
  };

  Game.prototype.bumpBlock = function (c, r) {
    const lv = this.level;
    const k = lv.tiles[r][c];
    const cx = c * TILE + TILE / 2, cy = r * TILE;
    if (k === T.QUESTION) {
      lv.tiles[r][c] = T.USED;
      const roll = Math.random();
      if (roll < 0.6) {
        this.coinCount++;
        this.score += 100;
        S.Audio.play('coin');
        S.spawnBurst(this.particles, cx, cy, '#ffd166', 10, 180);
      } else {
        const type = roll < 0.85 ? 'star' : 'heart';
        this.items.push(new S.Item(type, cx - 15, cy - 30));
        S.Audio.play('power');
      }
    } else if (k === T.BRICK) {
      lv.tiles[r][c] = T.EMPTY;
      S.Audio.play('stomp');
      S.spawnBurst(this.particles, cx, cy, lv.theme.brick, 12, 240);
    }
  };

  Game.prototype.checkCoins = function () {
    const p = this.player;
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (c.taken) continue;
      if (S.aabb(p, c)) {
        c.taken = true;
        this.coinCount++;
        this.score += 100;
        S.Audio.play('coin');
        S.spawnBurst(this.particles, c.x + 12, c.y + 12, '#ffd166', 6, 140);
        this.say('coin', 3);
      }
    }
  };

  Game.prototype.checkItems = function () {
    const p = this.player;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it.dead || it.pop > 0) continue;
      if (S.aabb(p, it)) {
        it.dead = true;
        if (it.type === 'star') {
          p.starT = 8;
          this.score += 300;
          S.Audio.play('power');
        } else {
          this.lives++;
          this.score += 200;
          S.Audio.play('oneup');
        }
      }
    }
  };

  Game.prototype.checkProjectiles = function () {
    for (let i = 0; i < this.projectiles.length; i++) {
      const pr = this.projectiles[i];
      if (pr.dead) continue;
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j];
        if (e.dead) continue;
        if (S.aabb(pr, e)) {
          e.dead = true;
          e.deadT = 0;
          this.score += 200;
          S.Audio.play('stomp');
          S.spawnBurst(this.particles, e.x + e.w / 2, e.y + e.h / 2, e.cfg.color, 12, 240);
          if (pr.kind === 'bunny') pr.dead = true;
        }
      }
    }
  };

  Game.prototype.checkEnemies = function () {
    const p = this.player;
    if (p.dead) return;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      if (!S.aabb(p, e)) continue;

      const stomping = p.vy > 60 && (p.y + p.h - e.y) < 22;
      if (stomping || p.starT > 0) {
        e.dead = true;
        e.deadT = 0;
        this.score += 200;
        p.vy = -520;
        p.jumps = Math.max(p.jumps - 1, 0);
        S.Audio.play('stomp');
        S.spawnBurst(this.particles, e.x + e.w / 2, e.y + e.h / 2, e.cfg.color, 12, 240);
      } else {
        this.hurt(e);
      }
    }
  };

  Game.prototype.checkSpikes = function () {
    const p = this.player;
    const c0 = Math.floor((p.x + 3) / TILE), c1 = Math.floor((p.x + p.w - 3) / TILE);
    const r0 = Math.floor((p.y + 4) / TILE), r1 = Math.floor((p.y + p.h - 2) / TILE);
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        if (r < 0 || r >= this.level.h) continue;
        if (this.level.tiles[r][c] === T.SPIKE) { this.hurt(null); return; }
      }
    }
  };

  Game.prototype.hurt = function (src) {
    const p = this.player;
    if (p.dead || p.inv > 0 || p.starT > 0 || p.dashT > 0) return;
    if (p.shieldT > 0) {
      p.shieldT = 0;
      p.inv = 1.2;
      if (src) src.vx *= -1;
      S.Audio.play('stomp');
      this.say('hurt', 0.5);
      S.spawnBurst(this.particles, p.x + p.w / 2, p.y + p.h / 2, '#8cd0ff', 14, 240);
      return;
    }
    this.lives--;
    p.inv = 2.2;
    p.hurtT = 0.8;
    p.vy = -340;
    p.vx = -p.facing * 180;
    S.Audio.play('hurt');
    this.say('hurt', 0.5);
    S.spawnBurst(this.particles, p.x + p.w / 2, p.y + p.h / 2, '#ff8c8c', 14, 240);
    if (this.lives <= 0) this.die();
  };

  Game.prototype.die = function () {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.deadT = 0;
    p.vy = -620;
    p.vx = 0;
    this.state = 'dying';
    S.Audio.stopMusic();
    S.Audio.play('die');
    this.say('die', 0);
  };

  /* ---------- 渲染 ---------- */
  Game.prototype.render = function () {
    const g = this.g, lv = this.level, p = this.player;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, VIEW_W, VIEW_H);

    S.drawBackground(g, lv, this.camX, this.time);

    g.save();
    g.translate(-this.camX, 0);
    S.drawTiles(g, lv, this.camX, this.time);
    S.drawGoal(g, lv, this.camX, this.time);

    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (c.taken) continue;
      if (c.x < this.camX - 60 || c.x > this.camX + VIEW_W + 60) continue;
      c.draw(g);
    }
    for (let i = 0; i < this.items.length; i++) this.items[i].draw(g);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.x < this.camX - 80 || e.x > this.camX + VIEW_W + 80) continue;
      e.draw(g);
    }
    for (let i = 0; i < this.projectiles.length; i++) this.projectiles[i].draw(g);
    for (let i = 0; i < this.particles.length; i++) this.particles[i].draw(g);

    if (p) S.drawPlayer(g, p);
    g.restore();

    // 冲刺速度线
    if (p && p.dashT > 0) {
      g.strokeStyle = 'rgba(255,255,255,.5)';
      g.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const y = 60 + i * 70 + (this.time * 400 % 70);
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(90, y);
        g.stroke();
      }
    }
  };

  S.Game = Game;
})(window.SHIN);
