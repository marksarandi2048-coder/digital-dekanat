'use strict';
// Тур по кабинету для жюри и новых студентов: 6 подсказок поверх интерфейса, каждая на своей странице.
// Затемнение с «окошком» вокруг нужного элемента и карточка с кнопками «Далее» / «Пропустить».
// Показывается один раз (память — в этом браузере, как тема); повторить можно из Профиля.
// Свой код, без библиотек. Только для студентов: запускает Главная (home.js) и кнопка в Профиле.
window.DekanatTour = (function () {
  const KEY = 'dekanat-tour'; // 'done' — тур показан; {"step":N} — тур идёт, шаг N
  const WAIT_MS = 6000; // сколько ждём, пока на странице появится нужный элемент
  const PAD = 8; // отступ «окошка» от элемента

  // Шаги: страница, элемент для подсветки, тексты. Последний шаг — на той же странице, что и предыдущий.
  const STEPS = [
    { path: '/today', target: '.tl', key: 'timeline' },
    { path: '/student-card', target: '.stc', key: 'card' },
    { path: '/grades', target: '#forecast', key: 'forecast' },
    { path: '/grades/bonus', target: '.bonus-progress', key: 'bonus' },
    { path: '/appointments', target: '#appt-form', key: 'appointment' },
    { path: '/appointments', target: '.assistant-fab', key: 'assistant' },
  ];

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function read() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      if (raw === 'done') return 'done';
      const step = JSON.parse(raw).step;
      return Number.isInteger(step) && step >= 0 && step < STEPS.length ? { step } : 'done';
    } catch {
      return 'done'; // хранилище запрещено — тур не навязываем
    }
  }

  function write(value) {
    try {
      window.localStorage.setItem(KEY, value === 'done' ? 'done' : JSON.stringify(value));
    } catch {
      // не сохранилось — тур просто закончится
    }
  }

  const here = () => (window.location.pathname.replace(/\/+$/, '') || '/');

  function go(step) {
    write({ step });
    if (here() === STEPS[step].path) show(step);
    else window.location.href = STEPS[step].path;
  }

  // ---------- Слой поверх страницы ----------
  let layer = null;
  let hole = null;
  let card = null;
  let target = null;
  let returnFocus = null;
  let queued = false;

  function build() {
    layer = el('div', 'tour');
    hole = el('div', 'tour__hole');
    hole.setAttribute('aria-hidden', 'true');
    card = el('div', 'tour__card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'tour-title');
    card.setAttribute('aria-describedby', 'tour-text');
    layer.append(hole, card);
    layer.addEventListener('keydown', onKey);
    document.body.append(layer);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
  }

  function close() {
    if (!layer) return;
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place);
    layer.remove();
    layer = null;
    target = null;
    document.documentElement.classList.remove('tour-open');
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  }

  function finish() {
    write('done');
    close();
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish();
      return;
    }
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      card.querySelector('.tour__next').click();
      return;
    }
    if (event.key === 'Tab') {
      // Фокус не уходит из карточки, пока она открыта
      const items = [...card.querySelectorAll('button')];
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !card.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  // Карточка: заголовок, текст, «Шаг 2 из 6», кнопки.
  function fill({ title, text, counter, nextLabel, skipLabel, onNext, onSkip }) {
    const head = el('div', 'tour__head');
    if (counter) head.append(el('p', 'tour__counter', counter));
    const h = el('h2', 'tour__title', title);
    h.id = 'tour-title';
    h.tabIndex = -1;
    head.append(h);
    const p = el('p', 'tour__text', text);
    p.id = 'tour-text';
    const actions = el('div', 'tour__actions');
    const skip = el('button', 'button-link tour__skip', skipLabel);
    skip.type = 'button';
    skip.addEventListener('click', onSkip);
    const next = el('button', 'button tour__next', nextLabel);
    next.type = 'button';
    next.addEventListener('click', onNext);
    actions.append(skip, next);
    card.replaceChildren(head, p, actions);
    h.focus({ preventScroll: true });
  }

  // Где стоят карточка и «окошко». Сначала карточка: рядом с элементом, если есть место, иначе внизу
  // (или вверху, если сам элемент внизу). «Окошко» — видимая часть элемента, не под шапкой и не под карточкой.
  function setCard(x, y) {
    card.style.left = x === null ? '' : `${x}px`;
    card.style.top = y === null ? '' : `${y}px`;
    card.style.bottom = y === null ? '' : 'auto';
  }

  function place() {
    if (!layer || queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      if (!layer) return;
      if (!target || !document.contains(target)) {
        hole.hidden = true;
        layer.classList.add('tour--plain');
        setCard(null, null);
        return;
      }
      hole.hidden = false;
      layer.classList.remove('tour--plain');
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const phone = vw <= 640;
      const r = target.getBoundingClientRect();
      const header = document.querySelector('.app-header');
      const headerBottom = phone && header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
      const lowTarget = r.top > vh / 2;
      let top = Math.max(r.top - PAD, headerBottom + 4);
      let bottom = Math.min(r.bottom + PAD, vh - 4);
      const left = Math.max(r.left - PAD, 4);
      const right = Math.min(r.right + PAD, vw - 4);

      if (phone) {
        // Карточка внизу над меню; если элемент сам внизу (кнопка помощника) — вверху под шапкой
        if (lowTarget) setCard(null, headerBottom + 12);
        else setCard(null, null);
      } else {
        const { width: w, height: h } = card.getBoundingClientRect();
        const clampX = (x) => Math.min(Math.max(x, 16), vw - w - 16);
        const clampY = (y) => Math.min(Math.max(y, 16), vh - h - 16);
        if (right + 16 + w <= vw - 16) setCard(right + 16, clampY(top));
        else if (bottom + 16 + h <= vh - 16) setCard(clampX(left), bottom + 16);
        else if (top - 16 - h >= 16) setCard(clampX(left), top - 16 - h);
        else if (left - 16 - w >= 16) setCard(left - 16 - w, clampY(top));
        else if (lowTarget) setCard(clampX(left + (right - left - w) / 2), 16);
        else setCard(clampX(left + (right - left - w) / 2), vh - h - 16);
      }
      // «Окошко» не заходит под карточку
      const c = card.getBoundingClientRect();
      const sideBySide = c.right <= left || c.left >= right;
      if (!sideBySide) {
        // Карточка в нижней половине экрана — «окошко» над ней, в верхней — под ней
        if (c.top + c.height / 2 >= vh / 2) bottom = Math.min(bottom, c.top - 10);
        else top = Math.max(top, c.bottom + 10);
      }
      // На телефоне «окошко» не заходит на нижнее меню
      const bottomNav = phone ? document.querySelector('.nav') : null;
      if (bottomNav && getComputedStyle(bottomNav).position === 'fixed') bottom = Math.min(bottom, bottomNav.getBoundingClientRect().top - 4);
      Object.assign(hole.style, {
        top: `${top}px`,
        left: `${left}px`,
        width: `${Math.max(0, right - left)}px`,
        height: `${Math.max(0, bottom - top)}px`,
      });
    });
  }

  // Ждём, пока страница нарисует нужный элемент (данные приходят с сервера не сразу).
  function waitFor(selector) {
    return new Promise((resolve) => {
      const found = () => {
        const node = document.querySelector(selector);
        return node && node.getClientRects().length ? node : null;
      };
      const now = found();
      if (now) {
        resolve(now);
        return;
      }
      const observer = new MutationObserver(() => {
        const node = found();
        if (node) {
          observer.disconnect();
          window.clearTimeout(timer);
          resolve(node);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
      const timer = window.setTimeout(() => {
        observer.disconnect();
        resolve(null); // элемента нет (например, сегодня нет пар) — покажем подсказку без подсветки
      }, WAIT_MS);
    });
  }

  function scrollTo(node) {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const r = node.getBoundingClientRect();
    const phone = document.documentElement.clientWidth <= 640;
    // На телефоне элемент — в верхней части экрана, под шапкой: снизу его закрыла бы карточка.
    const header = document.querySelector('.app-header');
    const pinned = header && ['fixed', 'sticky'].includes(getComputedStyle(header).position);
    const offset = phone ? (pinned ? header.getBoundingClientRect().height : 0) + 16 : Math.max(24, (window.innerHeight - r.height) / 2);
    const fixed = getComputedStyle(node).position === 'fixed';
    if (!fixed) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - offset), behavior });
  }

  async function show(step) {
    const s = STEPS[step];
    if (!layer) {
      returnFocus = document.activeElement;
      build();
    }
    document.documentElement.classList.add('tour-open');
    const last = step === STEPS.length - 1;
    fill({
      title: tr(`tour.${s.key}_title`),
      text: tr(`tour.${s.key}_text`),
      counter: tr('tour.counter', { n: step + 1, total: STEPS.length }),
      nextLabel: last ? tr('tour.done') : tr('tour.next'),
      skipLabel: tr('tour.skip'),
      onNext: () => (last ? finish() : go(step + 1)),
      onSkip: finish,
    });
    target = null;
    layer.classList.add('tour--plain');
    hole.hidden = true;
    const node = await waitFor(s.target);
    if (!layer) return;
    target = node;
    if (node) scrollTo(node);
    place();
    // После плавной прокрутки уточняем положение ещё раз
    window.setTimeout(place, 450);
  }

  // Приглашение на Главной при первом входе: тур не начинается сам, студент выбирает.
  function offer(role) {
    if (role !== 'student' || read() !== null || layer) return;
    returnFocus = document.activeElement;
    build();
    document.documentElement.classList.add('tour-open');
    layer.classList.add('tour--plain');
    hole.hidden = true;
    fill({
      title: tr('tour.welcome_title'),
      text: tr('tour.welcome_text'),
      counter: null,
      nextLabel: tr('tour.start'),
      skipLabel: tr('tour.later'),
      onNext: () => go(0),
      onSkip: finish,
    });
  }

  // Кнопка «Показать тур ещё раз» в Профиле.
  function restart() {
    go(0);
  }

  // Тур идёт — продолжаем на этой странице. Ушли с маршрута тура сами — тур заканчивается.
  const state = read();
  if (state && state !== 'done') {
    const s = STEPS[state.step];
    if (here() === s.path) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => show(state.step), { once: true });
      else show(state.step);
    } else {
      write('done');
    }
  }

  return { offer, restart };
})();
