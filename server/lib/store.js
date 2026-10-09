/* JSON 文件存储：内存缓存 + 防抖 + 原子写入（写临时文件后 rename） */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');

function fileOf(name) { return path.join(DIR, name + '.json'); }

const cache = {};   // name -> data
const timers = {};  // name -> 防抖定时器

function read(name, fallback) {
  if (cache[name] !== undefined) return cache[name];
  try {
    const raw = fs.readFileSync(fileOf(name), 'utf8');
    cache[name] = JSON.parse(raw);
  } catch (e) {
    cache[name] = fallback;
  }
  return cache[name];
}

function writeNow(name) {
  const p = fileOf(name);
  const tmp = p + '.tmp';
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(cache[name], null, 2), 'utf8');
    fs.renameSync(tmp, p);
  } catch (e) {
    console.error('[store] 写入失败 ' + name + '：' + e.message);
  }
}

// 防抖写入：合并高频请求，500ms 内只落盘一次
function write(name) {
  if (timers[name]) return;
  timers[name] = setTimeout(function () {
    timers[name] = null;
    writeNow(name);
  }, 500);
  if (timers[name].unref) timers[name].unref();
}

function flushAll() {
  Object.keys(timers).forEach(function (k) {
    if (timers[k]) { clearTimeout(timers[k]); timers[k] = null; writeNow(k); }
  });
}

module.exports = { read: read, write: write, flushAll: flushAll, DIR: DIR };
