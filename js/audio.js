/* 音频系统：Web Audio 合成音效 + 程序化 BGM + 浏览器 TTS 角色声线 + 外部素材自动覆盖
 * 外部素材：把 mp3 放进 assets/audio/（jump/coin/stomp/hurt/power/clear/die/oneup/skill/bgm）
 *          角色语音放 assets/audio/voice/{角色id}_{select|jump|hurt|coin|skill|clear|die}.mp3
 *          文件存在即自动使用，不存在则回退到合成音 / TTS。
 */
(function () {
  const S = window.SHIN;
  let ctx = null, master = null, sfxGain = null, musicGain = null;
  let sfxOn = true, bgmOn = true, voiceOn = true;
  let voices = [];

  const ext = {};      // 已探测到的外部音效 name -> url
  const extVoice = {}; // 已探测到的外部语音 'id_key' -> url

  const EXT_MAP = {
    jump: 'assets/audio/jump.mp3',
    coin: 'assets/audio/coin.mp3',
    stomp: 'assets/audio/stomp.mp3',
    hurt: 'assets/audio/hurt.mp3',
    power: 'assets/audio/power.mp3',
    clear: 'assets/audio/clear.mp3',
    die: 'assets/audio/die.mp3',
    oneup: 'assets/audio/oneup.mp3',
    skill: 'assets/audio/skill.mp3',
    bgm: 'assets/audio/bgm.mp3'
  };
  const VOICE_KEYS = ['select', 'jump', 'hurt', 'coin', 'skill', 'clear', 'die'];

  const A = {
    setSfx(v) { sfxOn = !!v; },
    setBgm(v) { bgmOn = !!v; if (!bgmOn) A.stopMusic(); },
    setVoice(v) { voiceOn = !!v; if (!voiceOn && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }
  };

  /* ---------- 基础设施 ---------- */
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.45; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.18; musicGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(o) {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const dur = o.dur || 0.12;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus || sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  function noise(o) {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const dur = o.dur || 0.1;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.value = o.freq || 900;
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol || 0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  function seq(notes, opt) {
    notes.forEach(function (n, i) {
      tone({
        freq: n, type: (opt && opt.type) || 'square',
        dur: (opt && opt.dur) || 0.1, vol: (opt && opt.vol) || 0.26,
        delay: i * ((opt && opt.step) || 0.09), bus: opt && opt.bus
      });
    });
  }

  /* ---------- 音效库（原创合成） ---------- */
  const SFX = {
    jump: function () { tone({ freq: 380, to: 900, dur: 0.15, type: 'square', vol: 0.26 }); },
    coin: function () { tone({ freq: 988, dur: 0.07, vol: 0.24 }); tone({ freq: 1319, dur: 0.16, vol: 0.22, delay: 0.07 }); },
    stomp: function () { noise({ dur: 0.09, freq: 700, vol: 0.3 }); tone({ freq: 220, to: 70, dur: 0.14, type: 'triangle', vol: 0.28 }); },
    hurt: function () { tone({ freq: 420, to: 120, dur: 0.34, type: 'sawtooth', vol: 0.26 }); },
    power: function () { seq([523, 659, 784, 1047, 1319], { step: 0.07, dur: 0.12, type: 'square' }); },
    oneup: function () { seq([659, 784, 1047], { step: 0.09, dur: 0.14, type: 'triangle' }); },
    clear: function () { seq([523, 659, 784, 1047, 784, 1047, 1319], { step: 0.14, dur: 0.2, vol: 0.28 }); },
    die: function () { tone({ freq: 340, to: 70, dur: 0.85, type: 'sawtooth', vol: 0.3 }); noise({ dur: 0.4, freq: 500, vol: 0.2, delay: 0.05 }); },
    skill: function () { tone({ freq: 200, to: 1400, dur: 0.28, type: 'sine', vol: 0.3 }); noise({ dur: 0.22, freq: 2600, filter: 'highpass', vol: 0.16 }); }
  };

  function playUrl(url, vol) {
    try {
      const a = new Audio(url);
      a.volume = vol == null ? 0.8 : vol;
      const p = a.play();
      if (p && p.catch) p.catch(function () { });
    } catch (e) { /* 静默降级 */ }
  }

  A.play = function (name) {
    if (!sfxOn) return;
    if (ext[name]) { playUrl(ext[name], 0.75); return; }
    const fn = SFX[name];
    if (fn) { ensure(); fn(); }
  };

  /* ---------- 外部素材探测 ---------- */
  function probe(url, onOk) {
    const a = new Audio();
    a.addEventListener('canplaythrough', function () { onOk(url); });
    a.addEventListener('loadeddata', function () { onOk(url); });
    a.preload = 'auto';
    a.src = url;
  }

  A.probeSfx = function () {
    Object.keys(EXT_MAP).forEach(function (k) {
      probe(EXT_MAP[k], function (url) { ext[k] = url; });
    });
  };

  A.probeVoice = function (charId) {
    VOICE_KEYS.forEach(function (key) {
      probe('assets/audio/voice/' + charId + '_' + key + '.mp3', function (url) {
        extVoice[charId + '_' + key] = url;
      });
    });
  };

  /* ---------- 角色声线 ---------- */
  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    voices = window.speechSynthesis.getVoices() || [];
  }
  if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }

  function pickVoice(lang) {
    if (!voices.length) loadVoices();
    const want = (lang || 'zh-CN').slice(0, 2).toLowerCase();
    const exact = voices.filter(function (v) { return (v.lang || '').toLowerCase().replace('_', '-') === (lang || '').toLowerCase(); });
    if (exact.length) return exact[0];
    const fuzzy = voices.filter(function (v) { return (v.lang || '').toLowerCase().indexOf(want) === 0; });
    return fuzzy.length ? fuzzy[Math.floor(Math.random() * fuzzy.length)] : null;
  }

  A.getLine = function (charId, key) {
    const ch = S.getCharacter(charId);
    if (!ch) return '';
    const v = ch.lines[key];
    return Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : (v || '');
  };

  // 播放角色台词：外部语音素材优先，其次 TTS（不同音高/语速 = 不同声线）
  A.speak = function (charId, key) {
    const text = A.getLine(charId, key);
    if (!voiceOn || !text) return '';     // 关闭声线时不显示台词
    const vk = charId + '_' + key;
    if (extVoice[vk]) { playUrl(extVoice[vk], 0.9); return text; }
    if (!('speechSynthesis' in window)) return text; // 无 TTS 时只显示字幕气泡
    const ch = S.getCharacter(charId);
    try {
      const u = new SpeechSynthesisUtterance(text);
      const vp = ch.voice;
      u.pitch = vp.pitch;
      u.rate = vp.rate;
      u.volume = 0.95;
      u.lang = vp.lang || 'zh-CN';
      const v = pickVoice(vp.lang);
      if (v) u.voice = v;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* 忽略不支持的浏览器 */ }
    return text;
  };

  /* ---------- 程序化 BGM ---------- */
  const MUSIC = {
    // 大调五声音阶循环，每关一个调式与节奏
    0: { root: 523.25, bass: [130.81, 174.61, 196.00, 174.61], lead: [0, 2, 4, 2, 7, 4, 2, 0], step: 0.19 },
    1: { root: 587.33, bass: [146.83, 196.00, 220.00, 196.00], lead: [0, 4, 7, 4, 9, 7, 4, 2], step: 0.17 },
    2: { root: 493.88, bass: [123.47, 164.81, 185.00, 164.81], lead: [0, 3, 7, 10, 7, 3, 0, -2], step: 0.15 }
  };
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; // 五声音阶半音偏移
  let musicTimer = null, musicStep = 0, musicTheme = 0;

  function noteFreq(semi, root) { return root * Math.pow(2, semi / 12); }

  function musicTick() {
    const m = MUSIC[musicTheme] || MUSIC[0];
    const step = musicStep % 16;
    const semi = SCALE[((m.lead[step % m.lead.length] % SCALE.length) + SCALE.length) % SCALE.length];
    tone({ freq: noteFreq(semi, m.root), dur: m.step * 0.9, vol: 0.16, type: 'square', bus: musicGain });
    if (step % 4 === 0) {
      tone({ freq: m.bass[(step / 4) % m.bass.length], dur: m.step * 3, vol: 0.16, type: 'triangle', bus: musicGain });
    }
    if (step % 8 === 4) noise({ dur: 0.05, freq: 5200, filter: 'highpass', vol: 0.05 });
    musicStep++;
  }

  A.startMusic = function (themeIndex) {
    A.stopMusic();
    if (!bgmOn) return;
    if (ext.bgm) { playUrl(ext.bgm, 0.4); return; }
    musicTheme = themeIndex || 0;
    musicStep = 0;
    ensure();
    const m = MUSIC[musicTheme] || MUSIC[0];
    musicTimer = setInterval(musicTick, m.step * 1000);
  };

  A.stopMusic = function () {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  };

  A.unlock = function () { ensure(); };

  S.Audio = A;
})();
