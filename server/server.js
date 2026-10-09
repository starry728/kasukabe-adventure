/* 春日部大冒险 · 轻量后端
 * 零依赖（只用 Node 内置模块）：静态托管 + REST API
 *   GET    /api/health                  健康检查
 *   GET    /api/leaderboard?level=&limit=  排行榜查询（level 省略=全部）
 *   POST   /api/leaderboard             提交成绩 {name,charId,level,score,coins}
 *   GET    /api/save?slot=              读取存档
 *   POST   /api/save                    写入存档 {slot,payload}
 *   DELETE /api/save?slot=              删除存档
 *   GET    /api/stats                   游玩统计
 *   POST   /api/stats                   上报事件 {type,charId,level,score}
 * 启动：node server/server.js   （或 npm start），端口用 PORT 环境变量覆盖
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const store = require('./lib/store');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const MAX_ENTRIES = 500;      // 排行榜最多保留条数
const MAX_BODY = 256 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

/* ---------- 工具 ---------- */
function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('请求体过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('JSON 解析失败')); }
    });
    req.on('error', reject);
  });
}

function clampStr(v, max, dflt) {
  const s = String(v == null ? dflt : v).replace(/\s+/g, ' ').trim().slice(0, max);
  return s || dflt;
}
function clampNum(v, min, max, dflt) {
  const n = Number(v);
  if (!isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/* ---------- 排行榜 ---------- */
function board() { return store.read('leaderboard', { entries: [] }); }

function submitScore(b) {
  const runId = clampStr(b.runId, 36, '');
  const e = {
    runId: runId,
    name: clampStr(b.name, 12, '无名氏'),
    charId: clampStr(b.charId, 16, 'shin'),
    level: clampNum(b.level, 0, 99, 0),
    score: clampNum(b.score, 0, 99999999, 0),
    coins: clampNum(b.coins, 0, 99999, 0),
    at: Date.now()
  };
  const data = board();

  // 同一 runId 的成绩幂等更新（自动提交/改名/点击不会重复上榜，分数取最高）
  if (runId) {
    let idx = -1;
    for (let i = 0; i < data.entries.length; i++) {
      if (data.entries[i].runId === runId) { idx = i; break; }
    }
    if (idx >= 0) {
      const old = data.entries[idx];
      e.score = Math.max(e.score, old.score); // 保留最高分
      data.entries[idx] = e;
    } else {
      data.entries.push(e);
    }
  } else {
    data.entries.push(e); // 兼容未带 runId 的旧客户端
  }

  data.entries.sort(function (a, c) { return c.score - a.score || a.at - c.at; });
  if (data.entries.length > MAX_ENTRIES) data.entries.length = MAX_ENTRIES;
  store.write('leaderboard');

  let rank = 0;
  for (let i = 0; i < data.entries.length; i++) {
    if (data.entries[i].runId === e.runId && data.entries[i].score === e.score) { rank = i + 1; break; }
  }
  return { rank: rank, total: data.entries.length, entry: e };
}

/* ---------- 存档 ---------- */
function saves() { return store.read('saves', {}); }

/* ---------- 统计 ---------- */
function stats() {
  return store.read('stats', {
    plays: 0, clears: 0, gameovers: 0,
    picks: {}, levelClears: {}, scoreTotal: 0, best: 0, startedAt: Date.now()
  });
}

function bump(obj, key, n) { obj[key] = (obj[key] || 0) + (n || 1); }

function recordEvent(b) {
  const s = stats();
  const type = clampStr(b.type, 16, 'unknown');
  const charId = clampStr(b.charId, 16, '');
  const level = clampNum(b.level, 0, 99, 0);
  const score = clampNum(b.score, 0, 99999999, 0);

  if (type === 'pick' && charId) bump(s.picks, charId);
  if (type === 'start') s.plays++;
  if (type === 'clear') { s.clears++; bump(s.levelClears, String(level)); }
  if (type === 'gameover') s.gameovers++;
  if (type === 'clear' || type === 'gameover') {
    s.scoreTotal += score;
    if (score > s.best) s.best = score;
  }
  store.write('stats');
  return s;
}

/* ---------- 静态文件 ---------- */
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const abs = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (abs.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(abs, function (err, st) {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(abs).pipe(res);
  });
}

/* ---------- 路由 ---------- */
const server = http.createServer(function (req, res) {
  const u = url.parse(req.url, true);
  const p = u.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' });
    return res.end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (p.indexOf('/api/') !== 0) return serveStatic(req, res, p);

  (async function () {
    try {
      if (p === '/api/health') {
        return json(res, 200, { ok: true, service: 'shin-runner', time: Date.now() });
      }

      if (p === '/api/leaderboard' && req.method === 'GET') {
        const level = u.query.level === undefined || u.query.level === '' ? null : Number(u.query.level);
        const limit = clampNum(u.query.limit, 1, 100, 20);
        let list = board().entries;
        if (level !== null && isFinite(level)) list = list.filter(function (e) { return e.level === level; });
        return json(res, 200, {
        entries: list.slice(0, limit).map(function (e, i) {
          return { rank: i + 1, name: e.name, charId: e.charId, level: e.level, score: e.score, coins: e.coins, at: e.at, runId: e.runId };
        }),
          total: list.length
        });
      }

      if (p === '/api/leaderboard' && req.method === 'POST') {
        const b = await readBody(req);
        if (!(Number(b.score) > 0)) return json(res, 400, { error: '分数无效' });
        const r = submitScore(b);
        const list = board().entries.slice(0, 10).map(function (e, i) {
          return { rank: i + 1, name: e.name, charId: e.charId, level: e.level, score: e.score, coins: e.coins, at: e.at };
        });
        return json(res, 200, { rank: r.rank, total: r.total, top: list });
      }

      if (p === '/api/save' && req.method === 'GET') {
        const slot = clampStr(u.query.slot, 32, 'default');
        const rec = saves()[slot];
        if (!rec) return json(res, 200, { exists: false });
        return json(res, 200, { exists: true, payload: rec.payload, updatedAt: rec.updatedAt });
      }

      if (p === '/api/save' && req.method === 'POST') {
        const b = await readBody(req);
        const slot = clampStr(b.slot, 32, 'default');
        const all = saves();
        all[slot] = { payload: b.payload || {}, updatedAt: Date.now() };
        store.write('saves');
        return json(res, 200, { ok: true, updatedAt: all[slot].updatedAt });
      }

      if (p === '/api/save' && req.method === 'DELETE') {
        const slot = clampStr(u.query.slot, 32, 'default');
        const all = saves();
        delete all[slot];
        store.write('saves');
        return json(res, 200, { ok: true });
      }

      if (p === '/api/stats' && req.method === 'GET') {
        return json(res, 200, stats());
      }

      if (p === '/api/stats' && req.method === 'POST') {
        const b = await readBody(req);
        return json(res, 200, { ok: true, stats: recordEvent(b) });
      }

      return json(res, 404, { error: '未知接口 ' + p });
    } catch (e) {
      return json(res, 400, { error: e.message || '请求处理失败' });
    }
  })();
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('春日部大冒险 · 后端已启动');
  console.log('  游戏地址：  http://127.0.0.1:' + PORT + '/');
  console.log('  健康检查：  http://127.0.0.1:' + PORT + '/api/health');
  console.log('  数据目录：  ' + store.DIR);
});

function shutdown() {
  console.log('\n正在保存数据并退出…');
  store.flushAll();
  server.close(function () { process.exit(0); });
  setTimeout(function () { process.exit(0); }, 1200);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
