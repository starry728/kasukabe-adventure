/* 输入：键盘 + 触屏虚拟按键 */
(function (S) {
  const down = { left: false, right: false, jump: false, skill: false };
  const pressed = { jump: false, skill: false };

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyK: 'jump',
    ShiftLeft: 'skill', ShiftRight: 'skill', KeyJ: 'skill', KeyL: 'skill'
  };

  const Input = {
    down: down,
    pressed: pressed,
    onPause: null,
    onConfirm: null,

    set: function (key, val) {
      if (key === 'jump' || key === 'skill') {
        if (val && !down[key]) pressed[key] = true;
      }
      down[key] = val;
    },

    init: function () {
      window.addEventListener('keydown', function (e) {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          if (Input.onPause) Input.onPause();
          e.preventDefault();
          return;
        }
        if (e.code === 'Enter') {
          if (Input.onConfirm) Input.onConfirm();
          return;
        }
        const k = KEYMAP[e.code];
        if (!k) return;
        e.preventDefault();
        if (!e.repeat) Input.set(k, true);
      });

      window.addEventListener('keyup', function (e) {
        const k = KEYMAP[e.code];
        if (!k) return;
        e.preventDefault();
        Input.set(k, false);
      });

      window.addEventListener('blur', function () {
        down.left = down.right = down.jump = down.skill = false;
      });

      // 触屏
      const btns = document.querySelectorAll('#touch .tbtn');
      Array.prototype.forEach.call(btns, function (b) {
        const key = b.getAttribute('data-key');
        const on = function (e) { e.preventDefault(); b.classList.add('down'); Input.set(key, true); };
        const off = function (e) { e.preventDefault(); b.classList.remove('down'); Input.set(key, false); };
        b.addEventListener('pointerdown', on);
        b.addEventListener('pointerup', off);
        b.addEventListener('pointercancel', off);
        b.addEventListener('pointerleave', off);
      });

      const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      if (isTouch) document.getElementById('touch').classList.remove('hidden');
    }
  };

  S.Input = Input;
})(window.SHIN);
