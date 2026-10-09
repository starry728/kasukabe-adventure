/* 全局常量与工具函数 */
window.SHIN = window.SHIN || {};

(function (S) {
  S.TILE = 40;
  S.ROWS = 13;
  S.VIEW_W = 960;
  S.VIEW_H = S.ROWS * S.TILE; // 520

  // 瓦片类型
  S.T = { EMPTY: 0, GROUND: 1, BRICK: 2, QUESTION: 3, STONE: 4, SPIKE: 5, FLAG: 6, USED: 7 };
  S.SOLID = { 0: false, 1: true, 2: true, 3: true, 4: true, 5: false, 6: false, 7: true };

  S.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  S.pick = function (arr, rnd) { return arr[Math.floor((rnd ? rnd() : Math.random()) * arr.length)]; };

  // 确定性随机（保证关卡每次生成一致）
  S.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  S.aabb = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  S.roundRect = function (g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  };

  S.ellipse = function (g, cx, cy, rx, ry) {
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };
})(window.SHIN);
