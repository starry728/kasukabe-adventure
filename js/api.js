/* 后端客户端：在线时走 /api/*，离线（直接双击 html）自动降级为 localStorage
 * 前端所有调用都经过这里，游戏本体不感知后端是否存在。
 */
(function (S) {
  const LS = {
    board: 'shin-runner-board',
    save: 'shin-runner-save',
    name: 'shin-runner-name',
    stats: 'shin-runner-stats'
  };

  function readLS(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式忽略 */ }
  }

  const API = {
    online: false,     // 探测结果
    ready: false,      // 探测是否结束
    base: '',
    _queue: [],

    /* 启动时探测后端；不阻塞游戏，探测前后都可用（离线走本地） */
    init: function () {
      const self = this;
      if (typeof fetch !== 'function') { this.online = false; this.ready = true; return; }
      fetch('api/health', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && d.ok) { self.online = true; self.ready = true; self._flush(); }
          else { self.online = false; self.ready = true; }
        })
        .catch(function () { self.online = false; self.ready = true; });
    },

    _flush: function () {
      const q = this._queue.slice();
      this._queue = [];
      q.forEach(function (fn) { fn(); });
    },

    /* ---------- 排行榜 ---------- */
    submitScore: function (entry, cb) {
      const self = this;
      if (!this.online) {
        const list = readLS(LS.board, []);
        list.push(Object.assign({ at: Date.now() }, entry));
        list.sort(function (a, b) { return b.score - a.score || a.at - b.at; });
        if (list.length > 100) list.length = 100;
        writeLS(LS.board, list);
        let rank = 0;
        for (let i = 0; i < list.length; i++) if (list[i].score === entry.score) { rank = i + 1; break; }
        if (cb) cb({ rank: rank, total: list.length, top: list.slice(0, 10), offline: true });
        return;
      }
      this._post('api/leaderboard', entry, function (d) {
        if (d && cb) cb(d);
      }, function () {
        self.online = false;             // 提交失败则退化为本地榜
        self.submitScore(entry, cb);
      });
    },

    getBoard: function (level, limit, cb) {
      const self = this;
      if (!this.online) {
        let list = readLS(LS.board, []);
        if (level !== null && level !== undefined) list = list.filter(function (e) { return e.level === level; });
        cb({
          entries: list.slice(0, limit || 20).map(function (e, i) { return Object.assign({ rank: i + 1 }, e); }),
          total: list.length, offline: true
        });
        return;
      }
      const q = 'api/leaderboard?limit=' + (limit || 20) + (level === null || level === undefined ? '' : '&level=' + level);
      this._get(q, function (d) {
        if (d && cb) cb(d);
      }, function () {
        self.online = false;
        self.getBoard(level, limit, cb);
      });
    },

    /* ---------- 存档 ---------- */
    saveProgress: function (payload) {
      if (!this.online) { writeLS(LS.save, payload); return; }
      this._post('api/save', { slot: 'default', payload: payload }, null, function () {
        writeLS(LS.save, payload);   // 后端不可用时兜底本地
      });
    },

    loadProgress: function (cb) {
      const self = this;
      if (!this.online) { cb(readLS(LS.save, null)); return; }
      this._get('api/save?slot=default', function (d) {
        if (d && d.exists) cb(d.payload);
        else cb(readLS(LS.save, null));
      }, function () {
        self.online = false;
        cb(readLS(LS.save, null));
      });
    },

    /* ---------- 统计 ---------- */
    track: function (evt) {
      if (!this.online) {
        const s = readLS(LS.stats, { plays: 0, clears: 0, gameovers: 0, picks: {} });
        if (evt.type === 'start') s.plays++;
        if (evt.type === 'clear') s.clears++;
        if (evt.type === 'gameover') s.gameovers++;
        if (evt.type === 'pick' && evt.charId) s.picks[evt.charId] = (s.picks[evt.charId] || 0) + 1;
        writeLS(LS.stats, s);
        return;
      }
      this._post('api/stats', evt, null, function () { /* 统计失败不影响游戏 */ });
    },

    getStats: function (cb) {
      if (!this.online) { cb(readLS(LS.stats, null)); return; }
      this._get('api/stats', function (d) { if (cb) cb(d); }, function () { cb(readLS(LS.stats, null)); });
    },

    /* ---------- 昵称 ---------- */
    getName: function () {
      try { return localStorage.getItem(LS.name) || ''; } catch (e) { return ''; }
    },
    setName: function (v) {
      try { localStorage.setItem(LS.name, String(v).slice(0, 12)); } catch (e) { }
    },

    /* ---------- 底层 ---------- */
    _get: function (url, ok, fail) {
      if (typeof fetch !== 'function') { if (fail) fail(); return; }
      fetch(url, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function (d) { if (ok) ok(d); })
        .catch(function () { if (fail) fail(); });
    },

    _post: function (url, body, ok, fail) {
      if (typeof fetch !== 'function') { if (fail) fail(); return; }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function (d) { if (ok) ok(d); })
        .catch(function () { if (fail) fail(); });
    }
  };

  S.API = API;
})(window.SHIN);
