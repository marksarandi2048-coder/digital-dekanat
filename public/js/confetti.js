'use strict';
// Золотое конфетти для радостных событий: справка готова, баллы начислены, запись на приём.
// Только украшение: смысл всегда есть в тексте на странице, программы экранного доступа конфетти не видят.
// При «Уменьшить движение» конфетти нет. Свой код, без библиотек.
window.DekanatConfetti = (function () {
  const KEY = 'dekanat-celebrated';
  const COLORS = ['#e6c67c', '#f3d68f', '#c9a24a', '#fff1c9', '#b8862b', '#9c7220'];
  const COUNT = 90;
  const LIFE_MS = 1900;

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Откуда летят бумажки: центр элемента, если он на экране, иначе — верх экрана посередине.
  function originOf(node) {
    if (node && node.getBoundingClientRect) {
      const r = node.getBoundingClientRect();
      if (r.width && r.bottom > 0 && r.top < window.innerHeight) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.3 };
  }

  function burst(node) {
    if (reduced() || document.visibilityState !== 'visible') return;
    // Ждём кадр: элемент, от которого летит конфетти, мог только что появиться на странице.
    window.requestAnimationFrame(() => fire(originOf(node)));
  }

  function fire({ x, y }) {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    canvas.setAttribute('aria-hidden', 'true');
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);

    // На телефоне разлёт меньше, чтобы бумажки не улетали за край сразу.
    const power = Math.min(w, 900) / 900;
    const pieces = Array.from({ length: COUNT }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const speed = (5 + Math.random() * 7) * (0.6 + power * 0.6);
      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        turn: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.35,
        flip: Math.random() * Math.PI,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.25,
      };
    });

    const started = performance.now();
    let last = started;
    const step = (now) => {
      const dt = Math.min(2, (now - last) / 16.7); // шаг в «кадрах», чтобы скорость не зависела от частоты экрана
      last = now;
      const t = (now - started) / LIFE_MS;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
      for (const p of pieces) {
        p.vx *= 0.985 ** dt;
        p.vy = p.vy * 0.985 ** dt + 0.28 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.turn += p.spin * dt;
        p.flip += 0.12 * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.turn);
        ctx.scale(1, Math.cos(p.flip)); // бумажка переворачивается в воздухе
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
      if (t < 1) window.requestAnimationFrame(step);
      else canvas.remove();
    };
    window.requestAnimationFrame(step);
  }

  function seen() {
    try {
      return JSON.parse(window.localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  }

  // Один раз на событие: «справка 12 готова» празднуется при первом показе, дальше — нет.
  function once(key, node) {
    const list = seen();
    if (list.includes(key)) return;
    list.push(key);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
    } catch {
      return; // хранилище запрещено — лучше без конфетти, чем при каждом открытии
    }
    burst(node);
  }

  return { burst, once };
})();
