/* 后端 API 用例：启动服务后跑 node tools/api-test.js [port] */
const PORT = Number(process.argv[2] || 3000);
const BASE = 'http://127.0.0.1:' + PORT;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('✔ ' + name + (extra ? ' → ' + extra : '')); }
  else { fail++; console.log('✘ ' + name + (extra ? ' → ' + extra : '')); }
}

function req(method, path, body) {
  return fetch(BASE + path, {
    method: method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  }).then(async function (r) {
    const txt = await r.text();
    let d = null;
    try { d = JSON.parse(txt); } catch (e) { }
    return { status: r.status, data: d, raw: txt };
  });
}

(async function () {
  console.log('=== 后端 API 测试（' + BASE + '）===');

  const h = await req('GET', '/api/health');
  check('健康检查返回 ok', h.status === 200 && h.data && h.data.ok, JSON.stringify(h.data));

  const st0 = await req('GET', '/api/stats');
  check('统计接口可读', st0.status === 200 && st0.data && typeof st0.data.plays === 'number');

  // 提交成绩
  const sub = await req('POST', '/api/leaderboard', { name: '测试员', charId: 'shin', level: 0, score: 12345, coins: 30 });
  check('提交成绩成功并返回名次', sub.status === 200 && sub.data && sub.data.rank >= 1,
    sub.data && ('名次=' + sub.data.rank + ' 总数=' + sub.data.total));
  check('返回 TOP 列表', sub.data && Array.isArray(sub.data.top) && sub.data.top.length >= 1);

  // 高分排前面
  await req('POST', '/api/leaderboard', { name: '高手', charId: 'kazama', level: 0, score: 99999, coins: 50 });
  const board = await req('GET', '/api/leaderboard?limit=5');
  check('高分排在首位', board.data.entries[0].score === 99999 && board.data.entries[0].name === '高手',
    board.data.entries[0].name + '/' + board.data.entries[0].score);

  // 同一 runId 多次提交应幂等更新，不重复上榜，分数取最高
  await req('POST', '/api/leaderboard', { name: '幂等', charId: 'shin', level: 1, score: 1200, coins: 5, runId: 'run-abc-001' });
  await req('POST', '/api/leaderboard', { name: '幂等改名', charId: 'shin', level: 1, score: 2200, coins: 8, runId: 'run-abc-001' });
  await req('POST', '/api/leaderboard', { name: '幂等再改', charId: 'shin', level: 1, score: 1800, coins: 6, runId: 'run-abc-001' });
  const boardIdem = await req('GET', '/api/leaderboard?limit=50');
  const sameRun = boardIdem.data.entries.filter(function (e) { return e.runId === 'run-abc-001'; });
  check('同一 runId 只保留一条记录', sameRun.length === 1, '实际 ' + sameRun.length + ' 条');
  check('分数取三次中的最大值', sameRun[0] && sameRun[0].score === 2200, 'score=' + (sameRun[0] && sameRun[0].score));
  check('昵称更新为最后一次提交', sameRun[0] && sameRun[0].name === '幂等再改', 'name=' + (sameRun[0] && sameRun[0].name));

  // 按关卡过滤
  const f = await req('GET', '/api/leaderboard?level=0&limit=10');
  check('按关卡过滤生效', f.data.entries.every(function (e) { return e.level === 0; }),
    f.data.entries.length + ' 条');

  // 非法分数被拒
  const bad = await req('POST', '/api/leaderboard', { name: 'x', charId: 'shin', level: 0, score: 0 });
  check('非法分数被拒绝', bad.status === 400, 'HTTP ' + bad.status);

  // 昵称长度与 HTML 转义
  const inj = await req('POST', '/api/leaderboard', { name: '<img src=x onerror=alert(1)>abcdefghij', charId: 'shin', level: 1, score: 500 });
  const b2 = await req('GET', '/api/leaderboard?level=1&limit=5');
  const saved = b2.data.entries.filter(function (e) { return e.score === 500; })[0];
  check('昵称被截断到 12 字符', saved && saved.name.length === 12, saved && saved.name);

  // 存档读写
  const sv = await req('POST', '/api/save', { slot: 'default', payload: { levelIndex: 2, charId: 'nene', totalScore: 8888 } });
  check('写入存档成功', sv.status === 200 && sv.data && sv.data.ok);
  const ld = await req('GET', '/api/save?slot=default');
  check('读取存档内容一致', ld.status === 200 && ld.data.exists && ld.data.payload.levelIndex === 2 && ld.data.payload.totalScore === 8888,
    JSON.stringify(ld.data.payload));

  const del = await req('DELETE', '/api/save?slot=default');
  check('删除存档成功', del.status === 200 && del.data.ok);
  const ld2 = await req('GET', '/api/save?slot=default');
  check('删除后读取为不存在', ld2.data && ld2.data.exists === false);

  // 统计累计
  await req('POST', '/api/stats', { type: 'start', charId: 'shin', level: 0 });
  await req('POST', '/api/stats', { type: 'pick', charId: 'shin' });
  await req('POST', '/api/stats', { type: 'clear', charId: 'shin', level: 0, score: 3000 });
  const st1 = await req('GET', '/api/stats');
  check('统计：开局次数已累加', st1.data.plays >= 1, 'plays=' + st1.data.plays);
  check('统计：选人次数已累加', (st1.data.picks.shin || 0) >= 1, 'shin=' + (st1.data.picks.shin || 0));
  check('统计：通关次数已累加', st1.data.clears >= 1, 'clears=' + st1.data.clears);
  check('统计：最高分已记录', st1.data.best >= 3000, 'best=' + st1.data.best);

  // 静态托管
  const idx = await req('GET', '/index.html');
  check('静态托管返回 index.html', idx.status === 200 && idx.raw.indexOf('春日部大冒险') > 0);
  const js = await fetch(BASE + '/js/api.js');
  check('静态托管返回 js 且 MIME 正确', js.status === 200 && /javascript/.test(js.headers.get('content-type') || ''),
    js.headers.get('content-type'));
  const miss = await fetch(BASE + '/nope.js');
  check('未知静态资源返回 404', miss.status === 404, 'HTTP ' + miss.status);

  // 目录穿越防护（用编码形式，避免客户端把 .. 规范化掉）
  const trav = await fetch(BASE + '/..%2f..%2f..%2f..%2fwindows%2fwin.ini');
  check('目录穿越（编码 ..）被拦截', trav.status === 404 || trav.status === 403, 'HTTP ' + trav.status);
  const trav2 = await fetch(BASE + '/%2e%2e%2f%2e%2e%2fpackage.json');
  const t2 = await trav2.text();
  // 该路径会被规范化回项目根目录内的 package.json，说明没有逃逸到外部
  check('编码穿越被规范化回根目录（未逃逸）', trav2.status === 200 && t2.indexOf('shin-chan-runner') > 0,
    'HTTP ' + trav2.status);
  const okFile = await fetch(BASE + '/package.json');
  check('根目录内合法文件可访问', okFile.status === 200, 'HTTP ' + okFile.status);

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.log('测试异常（后端未启动？）：' + e.message);
  process.exit(1);
});
