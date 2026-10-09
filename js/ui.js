/* UI：屏幕切换、选人、HUD、台词气泡、结算、排行榜 */
(function (S) {
  const $ = function (id) { return document.getElementById(id); };

  // 昵称等用户输入进入 DOM 前必须转义，避免 XSS
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  const UI = {
    game: null,
    charId: 'shin',
    levelIndex: 0,
    totalScore: 0,
    bubbleTimer: null,
    hudCache: {},

    init: function (game) {
      this.game = game;
      this.buildCharList();
      this.bindButtons();
      this.bindGameEvents();
      this.show('title');

      const self = this;
      S.API.init();
      // 后端探测是异步的，结果回来后刷新「继续冒险」按钮
      const wait = function (n) {
        if (S.API.ready || n <= 0) { self.refreshContinue(); return; }
        setTimeout(function () { wait(n - 1); }, 120);
      };
      wait(40);
      this.refreshContinue();
    },

    /* ---------- 屏幕 ---------- */
    show: function (name) {
      ['title', 'select', 'pause', 'result', 'rank'].forEach(function (n) {
        $('screen-' + n).classList.toggle('hidden', n !== name);
      });
      $('hud').classList.toggle('hidden', name !== 'game');
      if (name !== 'game') $('bubble').classList.add('hidden');
    },

    /* ---------- 存档：继续冒险 ---------- */
    refreshContinue: function () {
      const self = this;
      S.API.loadProgress(function (p) {
        self.saved = p || null;
        const btn = $('btn-continue');
        const ok = !!(p && typeof p.levelIndex === 'number' && p.levelIndex < S.LEVELS.length);
        btn.classList.toggle('hidden', !ok);
        if (ok) {
          const ch = S.getCharacter(p.charId) || S.CHARACTERS[0];
          btn.textContent = '继续冒险（' + ch.name + ' · 第 ' + (p.levelIndex + 1) + ' 关）';
        }
      });
    },

    /* ---------- 选人 ---------- */
    buildCharList: function () {
      const list = $('char-list');
      const self = this;
      list.innerHTML = '';
      S.CHARACTERS.forEach(function (ch) {
        const card = document.createElement('div');
        card.className = 'char-card' + (ch.id === self.charId ? ' active' : '');
        card.setAttribute('data-id', ch.id);

        const cvs = document.createElement('canvas');
        cvs.width = 192; cvs.height = 236;
        card.appendChild(cvs);

        const name = document.createElement('div');
        name.className = 'cname';
        name.textContent = ch.name;
        const nick = document.createElement('div');
        nick.className = 'cnick';
        nick.textContent = '「' + ch.nick + '」';
        card.appendChild(name);
        card.appendChild(nick);

        ['speed', 'jump', 'power'].forEach(function (k) {
          const label = { speed: '速度', jump: '跳跃', power: '力量' }[k];
          const row = document.createElement('div');
          row.className = 'stat';
          row.innerHTML = '<span>' + label + '</span><div class="bar"><i style="width:' + ch.bars[k] + '%"></i></div>';
          card.appendChild(row);
        });

        const tag = document.createElement('div');
        tag.className = 'skill-tag';
        tag.textContent = '技能 · ' + ch.skill.name + '：' + ch.skill.desc;
        card.appendChild(tag);

        list.appendChild(card);
        self.drawPreview(cvs, ch);

        card.addEventListener('click', function () {
          self.charId = ch.id;
          Array.prototype.forEach.call(list.children, function (c) {
            c.classList.toggle('active', c.getAttribute('data-id') === ch.id);
          });
          S.API.track({ type: 'pick', charId: ch.id });
          S.Audio.play('coin');
          S.Audio.probeVoice(ch.id);
          const text = S.Audio.speak(ch.id, 'select');
          if (text) self.bubble(text);
        });
      });
    },

    drawPreview: function (cvs, ch) {
      const self = this;
      try {
        const g = cvs.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, cvs.width, cvs.height);
        g.scale(2, 2);
        g.fillStyle = '#eaf6ff';
        S.roundRect(g, 4, 4, 88, 110, 12); g.fill();
        g.strokeStyle = '#cfdce8'; g.lineWidth = 1.5; g.stroke();
        S.drawCharacter(g, ch, { x: 48, y: 106, facing: 1, moving: false, air: false, t: 0.4, scale: 1.55 });
      } catch (e) {
        // 单张立绘绘制失败不应阻断整局游戏
        console.error('[立绘绘制失败] ' + ch.id, e);
        self.previewFailed = true;
      }
    },

    /* ---------- 按钮 ---------- */
    bindButtons: function () {
      const self = this, game = this.game;

      $('btn-start').addEventListener('click', function () {
        S.Audio.unlock();
        S.Audio.play('power');
        self.show('select');
      });
      $('btn-back-title').addEventListener('click', function () { self.show('title'); });
      $('btn-go').addEventListener('click', function () {
        S.Audio.unlock();
        self.levelIndex = 0;
        self.totalScore = 0;
        self.startLevel();
      });

      // 排行榜
      $('btn-rank').addEventListener('click', function () { self.openRank(); });
      $('btn-rank-back').addEventListener('click', function () { self.show('title'); });
      $('btn-rank-refresh').addEventListener('click', function () { self.loadRank(); });
      Array.prototype.forEach.call(document.querySelectorAll('.rank-tab'), function (b) {
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(document.querySelectorAll('.rank-tab'), function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          self.rankLevel = b.getAttribute('data-level') === '' ? null : Number(b.getAttribute('data-level'));
          self.loadRank();
        });
      });

      // 继续冒险
      $('btn-continue').addEventListener('click', function () {
        S.Audio.unlock();
        const p = self.saved;
        if (!p) return;
        self.charId = p.charId || 'shin';
        self.levelIndex = p.levelIndex || 0;
        self.totalScore = p.totalScore || 0;
        self.startLevel();
      });

      // 结算页：昵称与成绩提交
      const nameInput = $('player-name');
      nameInput.value = S.API.getName();
      nameInput.addEventListener('change', function () {
        S.API.setName(this.value.trim());
        if (self.lastSubmit) self.submitScore(self.lastSubmit.total, self.lastSubmit.level);
      });
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { this.blur(); }
        e.stopPropagation();   // 避免打字触发游戏快捷键
      });
      $('btn-submit-score').addEventListener('click', function () {
        S.API.setName(nameInput.value.trim());
        if (self.lastSubmit) self.submitScore(self.lastSubmit.total, self.lastSubmit.level);
      });

      $('btn-pause').addEventListener('click', function () { self.togglePause(); });
      $('btn-resume').addEventListener('click', function () { self.togglePause(); });
      $('btn-restart').addEventListener('click', function () {
        self.show('game');
        game.setPaused(false);
        game.restartLevel();
      });
      $('btn-quit').addEventListener('click', function () {
        game.setPaused(false);
        S.Audio.stopMusic();
        self.show('title');
        self.refreshContinue();
      });

      $('btn-next').addEventListener('click', function () {
        self.totalScore += self.lastScore || 0;
        self.levelIndex++;
        if (self.levelIndex >= S.LEVELS.length) self.levelIndex = 0;
        self.startLevel();
      });
      $('btn-retry').addEventListener('click', function () { self.startLevel(); });
      $('btn-home').addEventListener('click', function () {
        S.Audio.stopMusic();
        self.show('title');
        self.refreshContinue();
      });

      $('opt-sfx').addEventListener('change', function () { S.Audio.setSfx(this.checked); });
      $('opt-bgm').addEventListener('change', function () { S.Audio.setBgm(this.checked); });
      $('opt-voice').addEventListener('change', function () { S.Audio.setVoice(this.checked); });

      S.Input.onPause = function () { self.togglePause(); };
      S.Input.onConfirm = function () {
        if (!$('screen-title').classList.contains('hidden')) $('btn-start').click();
        else if (!$('screen-select').classList.contains('hidden')) $('btn-go').click();
        else if (!$('screen-result').classList.contains('hidden')) $('btn-next').click();
      };
    },

    togglePause: function () {
      const game = this.game;
      if (game.state !== 'playing') return;
      if (game.paused) {
        game.setPaused(false);
        this.show('game');
      } else {
        game.setPaused(true);
        this.show('pause');
      }
    },

    startLevel: function () {
      S.Audio.probeVoice(this.charId);
      this.show('game');
      this.game.start(this.levelIndex, this.charId);
      S.API.track({ type: 'start', charId: this.charId, level: this.levelIndex });
    },

    /* ---------- 成绩提交 ---------- */
    submitScore: function (total, level) {
      const self = this;
      const line = $('rank-line');
      if (!(total > 0)) { line.textContent = ''; return; }
      this.lastSubmit = { total: total, level: level };
      line.textContent = '成绩提交中…';
      S.API.submitScore({
        name: S.API.getName() || '无名氏',
        charId: self.charId,
        level: level,
        score: total,
        coins: self.game.coinCount
      }, function (d) {
        if (!d) { line.textContent = ''; return; }
        line.textContent = d.offline
          ? '本机第 ' + d.rank + ' 名（离线榜 · 共 ' + d.total + ' 条）'
          : '全球第 ' + d.rank + ' 名（共 ' + d.total + ' 条成绩）';
      });
    },

    /* ---------- 排行榜 ---------- */
    rankLevel: null,

    openRank: function () {
      this.show('rank');
      this.loadRank();
    },

    loadRank: function () {
      const self = this;
      $('rank-status').textContent = '加载中…';
      $('rank-body').innerHTML = '';
      S.API.getBoard(this.rankLevel, 20, function (d) { self.renderRank(d); });
    },

    renderRank: function (d) {
      const body = $('rank-body');
      const st = $('rank-status');
      if (!d || !d.entries || !d.entries.length) {
        body.innerHTML = '<div class="rank-empty">还没有成绩，快去跑一关吧！</div>';
        st.textContent = d && d.offline ? '离线模式：未连接后端，只显示本机成绩' : '';
        return;
      }
      body.innerHTML = d.entries.map(function (e) {
        const ch = S.getCharacter(e.charId);
        return '<div class="rank-row">' +
          '<span class="rk">' + e.rank + '</span>' +
          '<span class="rn">' + escapeHtml(e.name) + '</span>' +
          '<span class="rc">' + (ch ? ch.name : '?') + '</span>' +
          '<span class="rl">关卡 ' + (Number(e.level) + 1) + '</span>' +
          '<span class="rs">' + Number(e.score) + '</span>' +
          '</div>';
      }).join('');
      st.textContent = (d.offline ? '离线模式 · ' : '') + '共 ' + d.total + ' 条成绩';
    },

    /* ---------- 游戏事件 ---------- */
    bindGameEvents: function () {
      const self = this, game = this.game;

      game.on.frame = function (g) { self.updateHud(g); };
      game.on.bubble = function (text) { self.bubble(text); };

      game.on.clear = function (g) {
        self.lastScore = g.score;
        const total = self.totalScore + g.score;
        const last = self.levelIndex >= S.LEVELS.length - 1;
        $('result-title').textContent = last ? '全部通关！' : '关卡完成！';
        $('btn-next').classList.toggle('hidden', last);
        self.renderResult([
          ['关卡', S.LEVELS[self.levelIndex].name],
          ['本关得分', g.score],
          ['金币', g.coinCount],
          ['累计总分', total],
          ['最高纪录', self.best()]
        ]);
        self.saveBest(total);
        self.show('result');

        S.API.track({ type: 'clear', charId: self.charId, level: self.levelIndex, score: total });
        // 通关后存档推进到下一关；全部通关则回到第 1 关
        S.API.saveProgress({
          levelIndex: last ? 0 : self.levelIndex + 1,
          charId: self.charId,
          totalScore: last ? 0 : total
        });
        self.submitScore(total, self.levelIndex);
        self.refreshContinue();
      };

      game.on.gameover = function (g) {
        self.lastScore = g.score;
        const total = self.totalScore + g.score;
        $('result-title').textContent = '游戏结束';
        $('btn-next').classList.add('hidden');
        self.renderResult([
          ['关卡', S.LEVELS[self.levelIndex].name],
          ['本关得分', g.score],
          ['金币', g.coinCount],
          ['累计总分', total],
          ['最高纪录', self.best()]
        ]);
        self.saveBest(total);
        self.show('result');

        S.API.track({ type: 'gameover', charId: self.charId, level: self.levelIndex, score: total });
        self.submitScore(total, self.levelIndex);
      };
    },

    renderResult: function (rows) {
      $('result-body').innerHTML = rows.map(function (r) {
        return '<div>' + r[0] + '：<b>' + r[1] + '</b></div>';
      }).join('');
    },

    best: function () {
      try { return Number(localStorage.getItem('shin-runner-best') || 0); } catch (e) { return 0; }
    },
    saveBest: function (v) {
      try {
        if (v > this.best()) localStorage.setItem('shin-runner-best', String(v));
      } catch (e) { /* 隐私模式下忽略 */ }
    },

    /* ---------- HUD ---------- */
    updateHud: function (g) {
      if (g.state === 'idle') return;
      const p = g.player;
      const c = this.hudCache;
      if (c.char !== g.ch.nick) { $('hud-char').textContent = g.ch.nick; c.char = g.ch.nick; }
      if (c.score !== g.score) { $('hud-score').textContent = g.score; c.score = g.score; }
      if (c.coins !== g.coinCount) { $('hud-coins').textContent = g.coinCount; c.coins = g.coinCount; }
      if (c.level !== g.levelIndex) { $('hud-level').textContent = (g.levelIndex + 1) + ' / ' + S.LEVELS.length; c.level = g.levelIndex; }
      const t = Math.ceil(g.timeLeft);
      if (c.time !== t) { $('hud-time').textContent = t; c.time = t; }
      const lives = Math.max(0, g.lives);
      if (c.lives !== lives) { $('hud-lives').textContent = new Array(lives + 1).join('❤'); c.lives = lives; }
      if (c.skill !== g.ch.skill.name) { $('skill-label').textContent = g.ch.skill.name + '（Shift）'; c.skill = g.ch.skill.name; }
      const ratio = p.cdMax ? (1 - p.cd / p.cdMax) : 1;
      $('skill-fill').style.width = Math.round(ratio * 100) + '%';
    },

    /* ---------- 台词气泡 ---------- */
    bubble: function (text) {
      if (!text) return;
      const b = $('bubble');
      b.textContent = text;
      b.classList.remove('hidden');
      if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
      this.bubbleTimer = setTimeout(function () { b.classList.add('hidden'); }, 1900);
    }
  };

  S.UI = UI;
})(window.SHIN);
