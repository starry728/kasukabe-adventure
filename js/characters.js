/* 角色数据与矢量绘制（原创卡通造型，Canvas 手绘） */
(function (S) {
  const TAU = Math.PI * 2;

  S.CHARACTERS = [
    {
      id: 'shin', name: '野原新之助', nick: '小新', style: 'spike',
      bars: { speed: 72, jump: 80, power: 88 },
      stats: { speed: 275, jump: 700, gravity: 2000, maxJumps: 2, lives: 3 },
      skill: { id: 'beam', name: '动感光波', cd: 5, desc: '发射光波，贯穿前方敌人' },
      voice: { pitch: 1.8, rate: 1.15, lang: 'zh-CN' },
      lines: {
        select: '姐姐，要不要一起跑步啊～',
        jump: ['嘿咻！', '呀——！'],
        hurt: ['好痛痛…', '呜哇！'],
        coin: ['金币！', '买巧克力饼干！'],
        skill: '动感光波——！',
        clear: '赢啦！动感超人万岁！',
        die: '啊啊啊——救、救命啊！'
      },
      palette: { hair: '#2f2a28', skin: '#ffd9b0', shirt: '#e8453c', pants: '#f2c744', shoes: '#ffffff', accent: '#ffffff' }
    },
    {
      id: 'kazama', name: '风间彻', nick: '风间', style: 'bowl',
      bars: { speed: 96, jump: 62, power: 62 },
      stats: { speed: 315, jump: 645, gravity: 2100, maxJumps: 2, lives: 3 },
      skill: { id: 'dash', name: '精英冲刺', cd: 6, desc: '1.4 秒极速冲刺并无敌' },
      voice: { pitch: 1.25, rate: 1.0, lang: 'zh-CN' },
      lines: {
        select: '我是风间彻，这次要认真跑了。',
        jump: ['哼！', '看我的！'],
        hurt: ['呀！', '太失态了…'],
        coin: ['不错嘛。', '收集完成。'],
        skill: '精英冲刺！',
        clear: '完美通关，理所当然。',
        die: '不、不可能…'
      },
      palette: { hair: '#3c4a7a', skin: '#ffd9b0', shirt: '#5b8fd6', pants: '#d8c49a', shoes: '#4a4a4a', accent: '#ffffff' }
    },
    {
      id: 'nene', name: '樱田妮妮', nick: '妮妮', style: 'twin',
      bars: { speed: 58, jump: 100, power: 76 },
      stats: { speed: 260, jump: 765, gravity: 1750, maxJumps: 2, lives: 3 },
      skill: { id: 'bunny', name: '兔子布偶', cd: 4, desc: '抛出布偶，砸飞敌人' },
      voice: { pitch: 1.9, rate: 1.2, lang: 'zh-CN' },
      lines: {
        select: '妮妮天使，出动！',
        jump: ['啦～', '嘿！'],
        hurt: ['好过分！', '呜…'],
        coin: ['亮晶晶！', '是我的了～'],
        skill: '兔子布偶，惩罚你！',
        clear: '妮妮最棒了！',
        die: '讨厌讨厌讨厌！'
      },
      palette: { hair: '#8b5a3c', skin: '#ffe0bd', shirt: '#ff8fb1', pants: '#ffc2d6', shoes: '#ffffff', accent: '#ff5c8a' }
    },
    {
      id: 'masao', name: '佐藤正男', nick: '正男', style: 'bald',
      bars: { speed: 52, jump: 66, power: 45 },
      stats: { speed: 240, jump: 665, gravity: 1950, maxJumps: 2, lives: 4 },
      skill: { id: 'shield', name: '龟壳防御', cd: 8, desc: '3.5 秒内免疫一次伤害' },
      voice: { pitch: 1.35, rate: 0.85, lang: 'zh-CN' },
      lines: {
        select: '我、我会加油的…',
        jump: ['嘿…', '咦？'],
        hurt: ['好、好痛…', '救救我…'],
        coin: ['这个…可以捡吗？'],
        skill: '防、防御姿态！',
        clear: '我做到了…真的。',
        die: '这次也…不行吗…'
      },
      palette: { hair: '#5a4632', skin: '#ffd9b0', shirt: '#5fb762', pants: '#3f5f9e', shoes: '#ffffff', accent: '#ffffff' }
    },
    {
      id: 'boo', name: '阿呆', nick: '阿呆', style: 'thin',
      bars: { speed: 62, jump: 92, power: 70 },
      stats: { speed: 248, jump: 725, gravity: 1800, maxJumps: 2, lives: 3 },
      skill: { id: 'snot', name: '鼻涕绳索', cd: 5, desc: '弹射升空并短暂滑翔' },
      voice: { pitch: 0.7, rate: 0.7, lang: 'zh-CN' },
      lines: {
        select: '……（阿呆点点头）',
        jump: ['……', '哼。'],
        hurt: ['……！', '唔…'],
        coin: ['……（捡起来）'],
        skill: '鼻涕…发射。',
        clear: '……赢了。',
        die: '…………'
      },
      palette: { hair: '#4a4038', skin: '#ffd9b0', shirt: '#5a5f9e', pants: '#8a8f9e', shoes: '#3a3a3a', accent: '#bfe6ff' }
    }
  ];

  const MAP = {};
  S.CHARACTERS.forEach(function (c) { MAP[c.id] = c; });
  S.getCharacter = function (id) { return MAP[id] || S.CHARACTERS[0]; };

  /* ---------------- 绘制 ---------------- */

  function strokeShape(g, color, width) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  }

  function fillCircle(g, x, y, r) {
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  function outlineCircle(g, x, y, r, fillStyle, strokeStyle, lineW) {
    g.fillStyle = fillStyle;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = strokeStyle; g.lineWidth = lineW || 1.2;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }

  function hairCap(g, color, cy, r) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(0, cy, r + 1.2, Math.PI * 1.02, Math.PI * 1.98);
    g.closePath();
    g.fill();
  }

  function bangFringe(g, color, cy, r) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-r - 1, cy - 2);
    g.quadraticCurveTo(0, cy - r - 1, r + 1, cy - 2);
    g.quadraticCurveTo(r * 0.5, cy + 1, 0, cy - 1);
    g.quadraticCurveTo(-r * 0.5, cy + 1, -r - 1, cy - 2);
    g.closePath();
    g.fill();
  }

  function drawHair(g, ch, cy, r, t) {
    const P = ch.palette;
    switch (ch.style) {
      case 'spike': // 小新：黑色尖发 + 两撮刘海
        hairCap(g, P.hair, cy, r);
        g.fillStyle = P.hair;
        [-7, -1, 5].forEach(function (dx, i) {
          g.beginPath();
          g.moveTo(dx - 3, cy - r + 1);
          g.lineTo(dx + 1, cy - r - (7 + i % 2 * 3));
          g.lineTo(dx + 4, cy - r + 1);
          g.closePath();
          g.fill();
        });
        bangFringe(g, P.hair, cy, r);
        break;
      case 'bowl': // 风间：整齐短发 + 一撮标志性刘海
        hairCap(g, P.hair, cy, r);
        g.fillStyle = P.hair;
        // 额前斜刘海
        g.beginPath();
        g.moveTo(-r - 1, cy - 2);
        g.quadraticCurveTo(-r * 0.3, cy - r - 3, r + 1, cy - 3);
        g.lineTo(r + 1, cy + 1);
        g.quadraticCurveTo(r * 0.4, cy - r * 0.3, -r * 0.4, cy - 1);
        g.closePath();
        g.fill();
        // 两侧鬓角
        S.roundRect(g, -r - 2, cy - 4, 4, 10, 2); g.fill();
        S.roundRect(g, r - 2, cy - 4, 4, 10, 2); g.fill();
        break;
      case 'twin': // 妮妮：长发 + 蝴蝶结
        g.fillStyle = P.hair;
        S.roundRect(g, -r - 3, cy - 4, 6, 24, 3); g.fill();
        S.roundRect(g, r - 3, cy - 4, 6, 24, 3); g.fill();
        hairCap(g, P.hair, cy, r);
        bangFringe(g, P.hair, cy, r);
        g.fillStyle = P.accent;
        // 双马尾蝴蝶结
        [-1, 1].forEach(function (s) {
          g.beginPath();
          g.moveTo(s * (r - 1), cy - r - 2);
          g.lineTo(s * (r + 5), cy - r - 5);
          g.lineTo(s * (r + 5), cy - r + 3);
          g.closePath(); g.fill();
        });
        g.beginPath(); g.arc(0, cy - r - 2, 3, 0, TAU); g.fill();
        break;
      case 'bald': // 正男：光头 + 两小撮呆毛
        g.fillStyle = P.hair;
        // 头顶两撮小毛
        [-3, 3].forEach(function (dx) {
          g.beginPath();
          g.moveTo(dx - 2, cy - r + 3);
          g.quadraticCurveTo(dx + 1, cy - r - 5, dx + 4, cy - r + 3);
          g.fill();
        });
        break;
      case 'thin': // 阿呆：稀疏呆毛
        hairCap(g, P.hair, cy, r);
        g.strokeStyle = P.hair; g.lineWidth = 2.4; g.lineCap = 'round';
        [-4, 1, 6].forEach(function (dx, i) {
          g.beginPath();
          g.moveTo(dx, cy - r + 1);
          g.quadraticCurveTo(dx + (i - 1) * 2.5, cy - r - 7, dx + (i - 1) * 4, cy - r - 9);
          g.stroke();
        });
        g.fillStyle = P.hair;
        S.roundRect(g, -r - 1, cy - 3, (r + 1) * 2, 4, 2); g.fill();
        break;
    }
  }

  function drawFace(g, ch, cy, t, hurt) {
    const P = ch.palette;
    const eyeY = cy + 0.5;
    const blink = (t * 1.4 % 5) < 0.14;

    // 眼睛：更大更 Q
    [-4.8, 5].forEach(function (ex, i) {
      if (blink) {
        g.strokeStyle = '#22303f'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(ex - 4, eyeY); g.lineTo(ex + 4, eyeY); g.stroke();
        return;
      }
      // 眼白
      g.fillStyle = '#fff';
      S.ellipse(g, ex, eyeY, 4.5, 5.8); g.fill();
      g.strokeStyle = '#22303f'; g.lineWidth = 1; g.stroke();
      // 瞳孔
      g.fillStyle = '#22303f';
      g.beginPath(); g.arc(ex + (ch.style === 'bald' ? 0.4 : 0.9), eyeY + 0.8, 2.6, 0, TAU); g.fill();
      // 高光
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(ex - 0.8, eyeY - 1.2, 1.4, 0, TAU); g.fill();
    });

    // 眉毛（小新特别粗，其他人也带点特点）
    if (ch.style === 'spike') {
      g.strokeStyle = '#2f2a28'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-9.5, cy - 7); g.quadraticCurveTo(-5, cy - 9, -1, cy - 7); g.stroke();
      g.beginPath(); g.moveTo(1, cy - 7); g.quadraticCurveTo(5, cy - 9, 9.5, cy - 7); g.stroke();
    } else if (ch.style === 'bowl') {
      g.strokeStyle = P.hair; g.lineWidth = 1.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-7, cy - 8); g.lineTo(-2.5, cy - 9); g.stroke();
      g.beginPath(); g.moveTo(2.5, cy - 9); g.lineTo(7, cy - 8); g.stroke();
    } else if (ch.style === 'thin') {
      // 阿呆眉毛几乎看不见
      g.strokeStyle = P.hair; g.lineWidth = 1; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-6, cy - 7); g.lineTo(-3, cy - 6.5); g.stroke();
      g.beginPath(); g.moveTo(3, cy - 6.5); g.lineTo(6, cy - 7); g.stroke();
    } else {
      g.strokeStyle = P.hair; g.lineWidth = 1.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-6, cy - 7); g.quadraticCurveTo(-3, cy - 8, -1, cy - 7); g.stroke();
      g.beginPath(); g.moveTo(1, cy - 7); g.quadraticCurveTo(3, cy - 8, 6, cy - 7); g.stroke();
    }

    // 腮红：更明显的粉色圆团
    g.fillStyle = 'rgba(255,120,140,.45)';
    S.ellipse(g, -9, cy + 5.5, 3.6, 2.4); g.fill();
    S.ellipse(g, 9, cy + 5.5, 3.6, 2.4); g.fill();

    // 嘴
    g.strokeStyle = '#8c3b3b'; g.lineWidth = 1.6; g.lineCap = 'round';
    if (hurt) {
      g.fillStyle = '#8c3b3b';
      S.ellipse(g, 0.3, cy + 8.5, 3.8, 4.2); g.fill();
    } else if (ch.style === 'thin') {
      // 阿呆小圆嘴
      g.beginPath(); g.arc(0, cy + 7, 2.2, 0, TAU); g.stroke();
    } else {
      g.beginPath();
      g.arc(0.3, cy + 6, 3.6, 0.2 * Math.PI, 0.8 * Math.PI);
      g.stroke();
    }

    // 阿呆的鼻涕
    if (ch.style === 'thin') {
      const wob = Math.sin(t * 3) * 1.8;
      g.fillStyle = 'rgba(190,230,255,.85)';
      g.strokeStyle = 'rgba(120,180,210,.6)'; g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(2.8, cy + 5);
      g.quadraticCurveTo(7 + wob, cy + 10, 3.6, cy + 15);
      g.quadraticCurveTo(0.6 + wob * 0.5, cy + 10, 2.8, cy + 5);
      g.closePath();
      g.fill(); g.stroke();
    }
  }

  /* 绘制角色：原点 (x, y) 为脚底中心 */
  S.drawCharacter = function (g, ch, o) {
    const P = ch.palette;
    const scale = o.scale || 1;
    const t = o.t || 0;
    const moving = !!o.moving && !o.air;
    const swing = moving ? Math.sin(t * 13) : 0;

    g.save();
    g.translate(o.x, o.y);
    g.scale((o.facing === -1 ? -scale : scale), scale);

    if (o.invincible && Math.floor(t * 14) % 2 === 0) g.globalAlpha = 0.4;

    // Q 版尺寸：头更大，身体更短
    const headR = 13, headCY = -42;
    const bodyTop = -28, bodyH = 14;
    const footY = -4;
    const outline = '#2f2a28';

    // 影子
    g.fillStyle = 'rgba(0,0,0,.18)';
    S.ellipse(g, 0, 1, 16, 4.5); g.fill();

    // 腿（短粗 + 圆球鞋）
    const legA = o.air ? -0.45 : swing * 0.95;
    const legB = o.air ? 0.65 : -swing * 0.95;
    g.strokeStyle = P.skin; g.lineWidth = 5.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-4, bodyTop + bodyH); g.lineTo(-5 + legA * 6, footY + 4); g.stroke();
    g.beginPath(); g.moveTo(4, bodyTop + bodyH); g.lineTo(5 + legB * 6, footY + 4); g.stroke();

    // 鞋
    g.fillStyle = P.shoes;
    outlineCircle(g, -6 + legA * 6, footY, 5, P.shoes, outline, 1);
    outlineCircle(g, 6 + legB * 6, footY, 5, P.shoes, outline, 1);

    // 裤子 / 裙子
    if (ch.style === 'twin') {
      g.fillStyle = P.pants;
      g.beginPath();
      g.moveTo(-10, bodyTop + bodyH - 4);
      g.lineTo(10, bodyTop + bodyH - 4);
      g.lineTo(13, bodyTop + bodyH + 5);
      g.lineTo(-13, bodyTop + bodyH + 5);
      g.closePath();
      g.fill();
      strokeShape(g, outline, 1.2);
    } else {
      g.fillStyle = P.pants;
      S.roundRect(g, -11, bodyTop + bodyH - 7, 22, 10, 5); g.fill();
      strokeShape(g, outline, 1.2);
    }

    // 身体（更短更圆）
    g.fillStyle = P.shirt;
    S.roundRect(g, -12, bodyTop, 24, bodyH, 9); g.fill();
    strokeShape(g, outline, 1.2);
    // 领子
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath();
    g.moveTo(-6, bodyTop + 1); g.lineTo(0, bodyTop + 8); g.lineTo(6, bodyTop + 1);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.stroke();

    // 手臂（粗短 + 圆球手）
    g.strokeStyle = P.skin; g.lineWidth = 4.8; g.lineCap = 'round';
    let handLX, handLY, handRX, handRY;
    if (o.air) {
      g.beginPath(); g.moveTo(-10, bodyTop + 6); g.lineTo(-17, bodyTop - 5); g.stroke();
      g.beginPath(); g.moveTo(10, bodyTop + 6); g.lineTo(17, bodyTop - 5); g.stroke();
      handLX = -17; handLY = bodyTop - 5;
      handRX = 17; handRY = bodyTop - 5;
    } else {
      g.beginPath(); g.moveTo(-10, bodyTop + 6); g.lineTo(-10 - swing * 7, bodyTop + 15); g.stroke();
      g.beginPath(); g.moveTo(10, bodyTop + 6); g.lineTo(10 + swing * 7, bodyTop + 15); g.stroke();
      handLX = -10 - swing * 7; handLY = bodyTop + 15;
      handRX = 10 + swing * 7; handRY = bodyTop + 15;
    }
    g.fillStyle = P.skin;
    fillCircle(g, handLX, handLY, 3.2);
    fillCircle(g, handRX, handRY, 3.2);

    // 头轮廓 + 耳朵
    g.fillStyle = P.skin;
    outlineCircle(g, 0, headCY, headR, P.skin, outline, 1.2);
    g.fillStyle = P.skin;
    g.beginPath(); g.arc(-headR + 1, headCY + 1, 3.2, 0, TAU); g.fill();
    g.beginPath(); g.arc(headR - 1, headCY + 1, 3.2, 0, TAU); g.fill();
    g.strokeStyle = outline; g.lineWidth = 1.2;
    g.beginPath(); g.arc(-headR + 1, headCY + 1, 3.2, Math.PI * 0.6, Math.PI * 1.4); g.stroke();
    g.beginPath(); g.arc(headR - 1, headCY + 1, 3.2, Math.PI * 1.6, Math.PI * 2.4); g.stroke();

    drawHair(g, ch, headCY, headR, t);
    drawFace(g, ch, headCY, t, o.hurt);

    g.restore();
  };
})(window.SHIN);
