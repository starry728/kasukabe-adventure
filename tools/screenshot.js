/* 用无头 Chrome 截图，便于核对界面布局（HUD 遮挡等问题）
 * 用法：node tools/screenshot.js [输出文件名] [阶段: title|game|rank]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outName = process.argv[2] || 'shot.png';
const stage = process.argv[3] || 'game';
const PORT = Number(process.argv[4] || 3000);

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const script = `
<script>
setTimeout(function () {
  var S = window.SHIN;
  if (!S || !S.UI) return;
  var stage = ${JSON.stringify(stage)};
  if (stage === 'game') {
    document.getElementById('btn-start').click();
    document.getElementById('btn-go').click();
    var g = S.UI.game;
    S.Input.down.right = true;
    for (var i = 0; i < 120; i++) { if (i % 40 === 0) S.Input.pressed.jump = true; g.update(1/60); }
    g.render();
    S.UI.updateHud(g);
  } else if (stage === 'rank') {
    document.getElementById('btn-rank').click();
  } else if (stage === 'select') {
    document.getElementById('btn-start').click();
  }
}, 700);
</script>
`;

html = html.replace('</body>', script + '</body>');
const tmp = path.join(root, '_shot.html');
fs.writeFileSync(tmp, html, 'utf8');
const outPng = path.join(root, outName);

execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--hide-scrollbars',
  '--window-size=1200,760',
  '--virtual-time-budget=4000',
  '--screenshot=' + outPng,
  'http://127.0.0.1:' + PORT + '/_shot.html'
], { stdio: ['ignore', 'ignore', 'ignore'] });

try { fs.unlinkSync(tmp); } catch (e) { }
console.log('截图已保存：' + outPng);
