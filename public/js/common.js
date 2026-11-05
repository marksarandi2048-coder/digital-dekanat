'use strict';
// Общие функции для всех страниц личного кабинета.
// Важно: любые данные выводятся только через textContent — так текст
// никогда не превратится в HTML-код (защита от внедрения скриптов).
window.Dekanat = (function () {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  // Запрос к серверу. Если сессия закончилась — отправляем на страницу входа.
  async function fetchJSON(url) {
    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch {
      throw new Error('Нет связи с сервером. Проверьте интернет и обновите страницу.');
    }
    if (res.status === 401) {
      window.location.href = '/';
      return new Promise(() => {}); // страница уходит, дальше ничего не делаем
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Не удалось загрузить данные');
    return data;
  }

  // ---------- Даты ----------
  // Дата приходит как «ГГГГ-ММ-ДД»; форматируем её без сдвига часовых поясов.
  function formatDate(dateStr, options) {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', ...options }).format(
      new Date(`${dateStr}T00:00:00Z`),
    );
  }
  const dayMonth = (d) => formatDate(d, { day: 'numeric', month: 'long' });
  const weekdayLong = (d) => formatDate(d, { weekday: 'long' });
  const weekdayShort = (d) => formatDate(d, { weekday: 'short' });
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // «ЧЧ:ММ» → минуты между двумя моментами одного дня.
  const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const minutesBetween = (from, to) => toMinutes(to) - toMinutes(from);
  // 25 → «25 мин», 80 → «1 ч 20 мин», 120 → «2 ч»
  function duration(min) {
    if (min < 1) return 'меньше минуты';
    if (min < 60) return `${min} мин`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  }
  const fullDate = (d) => formatDate(d, { day: 'numeric', month: 'long', year: 'numeric' });
  // «ГГГГ-ММ-ДД ЧЧ:ММ» → «3 ноября, 15:40»
  const dateTime = (stamp) => (stamp ? `${dayMonth(stamp.slice(0, 10))}, ${stamp.slice(11, 16)}` : '');

  // Отправка данных на сервер. Возвращает { ok, data }.
  async function postJSON(url, body) {
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      return { ok: false, data: { error: 'Нет связи с сервером. Попробуйте ещё раз.' } };
    }
    if (res.status === 401) {
      window.location.href = '/';
      return new Promise(() => {});
    }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  // ---------- Занятия ----------
  const KIND = { lecture: 'Лекция', seminar: 'Семинар', practice: 'Практическое занятие' };
  const BADGE = {
    moved: 'Перенесено',
    teacher_changed: 'Замена преподавателя',
    room_changed: 'Другая аудитория',
    cancelled: 'Отменено',
  };

  // «Беляев Игорь Сергеевич» → «Беляев И. С.»
  function shortName(fullName) {
    if (!fullName) return '';
    const [last, ...rest] = fullName.split(/\s+/);
    return [last, ...rest.map((p) => `${p[0]}.`)].join(' ');
  }

  function place(building, room) {
    const roomText = /^\d+[а-яА-Яa-zA-Z]?$/.test(room) ? `ауд. ${room}` : room;
    return `${building}, ${roomText}`;
  }

  const slot = (date, pair, time) =>
    `${weekdayShort(date)}, ${dayMonth(date)}, ${pair} пара${time ? ` (${time.start}–${time.end})` : ''}`;

  function timeColumn(pair, time) {
    const col = el('div', 'lesson__time');
    col.setAttribute('aria-label', `${pair} пара, с ${time.start} до ${time.end}`);
    col.append(el('span', 'lesson__pair', `${pair} пара`), el('span', null, time.start), el('span', null, time.end));
    return col;
  }

  // Название дисциплины с цветной меткой (цвет — подсказка, название всегда рядом).
  function disciplineTitle(tag, className, name, color) {
    const title = el(tag, className);
    const dot = el('span', `disc-dot disc-${Number.isInteger(color) ? color : 0}`);
    dot.setAttribute('aria-hidden', 'true');
    title.append(dot, document.createTextNode(name));
    return title;
  }

  // Что изменилось у занятия — строками («Было: …», «Вместо: …», причина).
  function changeLines(lesson) {
    const c = lesson.change;
    if (!c) return [];
    const lines = [];
    if (lesson.status === 'moved') lines.push(`Было: ${slot(c.oldDate, c.oldPair, c.oldTime)}`);
    if (lesson.status === 'teacher_changed') lines.push(`Вместо: ${shortName(c.oldTeacher)}`);
    if (lesson.status === 'room_changed') lines.push(`Было: ${place(c.oldBuilding, c.oldRoom)}`);
    if (c.note) lines.push(c.note);
    return lines;
  }

  // Карточка занятия. mark: 'now' | 'next' | undefined.
  function renderLesson(lesson, mark) {
    const card = el('article', `lesson lesson--${lesson.status}`);
    const body = el('div', 'lesson__body');

    const tags = el('div', 'lesson__tags');
    if (lesson.status !== 'normal') tags.append(el('span', 'badge badge--' + lesson.status, BADGE[lesson.status]));
    // mark — { type: 'now', left } для текущей пары или { type: 'next', in } для следующей.
    if (mark && mark.type === 'now') {
      card.classList.add('lesson--current');
      tags.append(el('span', 'tag tag--now', `Сейчас идёт · ещё ${duration(mark.left)}`));
    }
    if (mark && mark.type === 'next') tags.append(el('span', 'tag tag--next', `Следующая через ${duration(mark.in)}`));
    if (tags.childElementCount) body.append(tags);

    body.append(disciplineTitle('h3', 'lesson__title', lesson.discipline, lesson.color));

    const teacherLine = el('p', 'lesson__meta');
    teacherLine.append(document.createTextNode(`${KIND[lesson.kind] || ''} · `));
    const teacher = el('span', lesson.status === 'teacher_changed' ? 'is-changed' : null, shortName(lesson.teacher));
    teacherLine.append(teacher);
    if (lesson.teacherTitle) teacherLine.append(document.createTextNode(`, ${lesson.teacherTitle}`));
    body.append(teacherLine);

    body.append(
      el('p', 'lesson__place' + (lesson.status === 'room_changed' ? ' is-changed' : ''), place(lesson.building, lesson.room)),
    );

    for (const line of changeLines(lesson)) body.append(el('p', 'lesson__change', line));

    card.append(timeColumn(lesson.pair, lesson.time), body);
    return card;
  }

  // «Призрак» на старом месте перенесённого занятия.
  function renderMovedAway(lesson) {
    const card = el('article', 'lesson lesson--ghost');
    const body = el('div', 'lesson__body');
    const tags = el('div', 'lesson__tags');
    tags.append(el('span', 'badge badge--moved', 'Перенесено'));
    body.append(
      tags,
      disciplineTitle('h3', 'lesson__title', lesson.discipline, lesson.color),
      el('p', 'lesson__change', `Перенесено на ${slot(lesson.date, lesson.pair, lesson.time)}`),
    );
    card.append(timeColumn(lesson.change.oldPair, lesson.change.oldTime), body);
    return card;
  }

  // Список занятий одного дня: настоящие занятия + «призраки», по порядку пар.
  function renderDay(date, data) {
    const items = [
      ...data.lessons.filter((l) => l.date === date).map((l) => ({ pair: l.pair, lesson: l })),
      ...data.movedAway
        .filter((l) => l.change.oldDate === date)
        .map((l) => ({ pair: l.change.oldPair, ghost: l })),
    ].sort((a, b) => a.pair - b.pair || (a.ghost ? 1 : -1));

    // Отметки «сейчас идёт» / «следующая через N минут» — только для сегодняшнего дня.
    // Время берётся московское, с сервера (data.now.time).
    const marks = {};
    let finished = false;
    if (date === data.now.date) {
      const now = data.now.time;
      const real = items.filter((i) => i.lesson && i.lesson.status !== 'cancelled').map((i) => i.lesson);
      const current = real.find((l) => l.time.start <= now && now < l.time.end);
      const next = real.find((l) => l.time.start > now);
      if (current) marks[current.id] = { type: 'now', left: minutesBetween(now, current.time.end) };
      if (next) marks[next.id] = { type: 'next', in: minutesBetween(now, next.time.start) };
      finished = real.length > 0 && !current && !next;
    }

    const list = el('div', 'lesson-list');
    for (const item of items) {
      if (item.ghost) list.append(renderMovedAway(item.ghost));
      else list.append(renderLesson(item.lesson, marks[item.lesson.id]));
    }
    return { list, count: items.length, finished };
  }

  // ---------- Выбор группы (только для сотрудника) и подпись группы ----------
  function setupGroup(data) {
    const info = document.getElementById('group-info');
    const picker = document.getElementById('group-picker');
    if (!data.groups) {
      if (info && data.group) {
        info.textContent = `Группа ${data.group}`;
        info.hidden = false;
      }
      return;
    }
    const select = document.getElementById('group-select');
    select.replaceChildren(...data.groups.map((g) => {
      const option = el('option', null, g);
      option.value = g;
      option.selected = g === data.group;
      return option;
    }));
    select.onchange = () => {
      const params = new URLSearchParams(window.location.search);
      params.set('group', select.value);
      window.location.search = params.toString();
    };
    picker.hidden = false;
  }

  // ---------- Пустые состояния с иллюстрациями ----------
  // Иллюстрации — собственные простые рисунки. Цвета берутся из темы (CSS-переменные --illu-*).
  // Это наши константы, а не данные пользователя, поэтому их можно вставлять как разметку.
  const ILLUSTRATIONS = {
    // Чашка с паром и солнце — «можно выдохнуть»
    rest: '<ellipse cx="80" cy="106" rx="54" ry="7" class="i-fill"/><circle cx="124" cy="28" r="12" class="i-accent"/>'
      + '<path d="M44 56h58v18a26 26 0 0 1-26 26h-6a26 26 0 0 1-26-26z" class="i-paper i-line"/>'
      + '<path d="M102 62h6a10 10 0 0 1 0 20h-8" class="i-line"/><path d="M34 102h92" class="i-line"/>'
      + '<path d="M60 44c-5-6 5-10 0-17M73 44c-5-6 5-10 0-17M86 44c-5-6 5-10 0-17" class="i-line i-soft"/>',
    // Документ с плюсом — «закажите первую справку»
    request: '<ellipse cx="80" cy="108" rx="50" ry="6" class="i-fill"/>'
      + '<path d="M54 12h38l20 20v64a6 6 0 0 1-6 6H54a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" class="i-paper i-line"/>'
      + '<path d="M92 12v20h20" class="i-line"/><path d="M60 48h34M60 60h34M60 72h22" class="i-line i-soft"/>'
      + '<circle cx="112" cy="86" r="17" class="i-accent"/><path d="M112 78v16M104 86h16" class="i-on-accent"/>',
    // Колокольчик с галочкой — «всё прочитано»
    read: '<ellipse cx="80" cy="108" rx="48" ry="6" class="i-fill"/>'
      + '<path d="M78 18a28 28 0 0 0-28 28c0 26-10 36-10 36h76s-10-10-10-36a28 28 0 0 0-28-28z" class="i-paper i-line"/>'
      + '<path d="M70 90a8 8 0 0 0 16 0" class="i-line"/>'
      + '<circle cx="112" cy="34" r="17" class="i-accent"/><path d="M104 34l6 6 10-12" class="i-on-accent"/>',
    // Указатель «не туда» — для страницы 404
    lost: '<ellipse cx="80" cy="108" rx="52" ry="6" class="i-fill"/><path d="M80 24v80" class="i-line"/>'
      + '<path d="M80 30h36l10 10-10 10H80z" class="i-paper i-line"/><path d="M80 58H44L34 68l10 10h36z" class="i-paper i-line"/>'
      + '<circle cx="80" cy="18" r="6" class="i-accent"/><path d="M92 40h18M50 68h18" class="i-line i-soft"/>',
    // Отключённая вилка — для страницы 500
    error: '<ellipse cx="80" cy="108" rx="52" ry="6" class="i-fill"/>'
      + '<path d="M30 70h22M108 70h22" class="i-line"/>'
      + '<path d="M52 54h14a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H52z" class="i-paper i-line"/><path d="M72 62h6M72 78h6" class="i-line"/>'
      + '<path d="M108 54H94a6 6 0 0 0-6 6v20a6 6 0 0 0 6 6h14z" class="i-paper i-line"/>'
      + '<circle cx="80" cy="30" r="14" class="i-accent"/><path d="M80 22v9M80 37v1" class="i-on-accent"/>',
  };

  function illustration(name, className) {
    const box = el('span', `illu${className ? ` ${className}` : ''}`);
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = `<svg viewBox="0 0 160 120" width="160" height="120" fill="none" stroke-linecap="round" stroke-linejoin="round">${ILLUSTRATIONS[name]}</svg>`;
    return box;
  }

  // Пустое состояние: рисунок, заголовок, пояснение и (по желанию) кнопка.
  // inline — компактный вариант в строку (рисунок слева).
  function emptyState({ illu, title, text, action, inline }) {
    const box = el('div', `empty${inline ? ' empty--inline' : ''}`);
    if (illu) box.append(illustration(illu));
    const words = el('div', 'empty__words');
    words.append(el('p', 'empty__title', title));
    if (text) words.append(el('p', 'muted empty__text', text));
    box.append(words);
    if (action) {
      const a = el('a', `button ${action.secondary ? 'button--secondary ' : ''}empty__action`, action.label);
      a.href = action.href;
      box.append(a);
    }
    return box;
  }

  // ---------- Обратный отсчёт: «сегодня», «завтра», «через 3 дня» ----------
  function countdown(days) {
    if (days <= 0) return 'сегодня';
    if (days === 1) return 'завтра';
    return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
  }

  // ---------- Скелетоны: серые заглушки, пока грузятся данные ----------
  // На странице: <div class="state skeleton" data-skeleton="tiles|lessons|list|card|summary|profile">.
  // Страница сама прячет этот блок, когда данные пришли.
  function skLine(width, size) {
    return el('span', `sk sk-line sk-w${width}${size ? ` sk-${size}` : ''}`);
  }
  function skCard(...children) {
    const card = el('div', 'sk-card');
    card.append(...children);
    return card;
  }
  const SKELETONS = {
    tiles() {
      const grid = el('div', 'tiles tiles--student');
      const hero = el('div', 'sk-card sk-hero tile--full');
      hero.append(skLine(30, 'small'), skLine(60, 'big'), skLine(40), skLine(50));
      grid.append(hero);
      for (let i = 0; i < 4; i += 1) grid.append(skCard(skLine(50, 'small'), skLine(40, 'big'), skLine(90), skLine(70)));
      return [grid];
    },
    lessons() {
      return [1, 2, 3].map(() => skCard(skLine(20, 'small'), skLine(60), skLine(80), skLine(40)));
    },
    list() {
      return [1, 2, 3, 4].map(() => skCard(skLine(30, 'small'), skLine(70), skLine(50)));
    },
    card() {
      return [skCard(skLine(50, 'big'), skLine(90), skLine(80), skLine(85), skLine(60))];
    },
    summary() {
      return [skCard(skLine(40, 'small'), skLine(30, 'big'), skLine(90), skLine(90), skLine(70)), ...this.list().slice(0, 3)];
    },
    profile() {
      const head = el('div', 'sk-row');
      head.append(el('span', 'sk sk-avatar'), skLine(50, 'big'));
      return [head, skLine(70), skLine(60), skLine(40)];
    },
  };
  for (const box of document.querySelectorAll('[data-skeleton]')) {
    const make = SKELETONS[box.dataset.skeleton];
    if (!make) continue;
    const parts = make.call(SKELETONS);
    for (const part of parts) part.setAttribute('aria-hidden', 'true');
    box.append(...parts);
  }

  // ---------- Колокольчик со счётчиком непрочитанных ----------
  async function updateBell() {
    const bell = document.getElementById('bell');
    if (!bell) return;
    const badge = document.getElementById('bell-count');
    let data;
    try {
      const res = await fetch('/api/notifications/count', { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      data = await res.json();
    } catch {
      return;
    }
    // Пункт «Уведомления» в боковом меню (на компьютере) — с тем же счётчиком.
    const navItem = document.getElementById('nav-notifications');
    const navCount = document.getElementById('nav-count');
    if (data.role === 'staff') {
      bell.href = '/announcements';
      bell.setAttribute('aria-label', 'Объявления');
      if (navItem) {
        navItem.href = '/announcements';
        document.getElementById('nav-notifications-label').textContent = 'Объявления';
      }
      return;
    }
    const n = data.count || 0;
    const label = n ? `Уведомления: ${n} ${plural(n, 'непрочитанное', 'непрочитанных', 'непрочитанных')}` : 'Уведомления';
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = n === 0;
    bell.setAttribute('aria-label', label);
    if (navCount) {
      navCount.textContent = badge.textContent;
      navCount.hidden = n === 0;
      navItem.setAttribute('aria-label', label);
    }
  }
  updateBell();

  // ---------- Выход ----------
  const logout = document.getElementById('logout-button');
  if (logout) {
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      try {
        await fetch('/api/logout', { method: 'POST' });
      } finally {
        window.location.href = '/';
      }
    });
  }

  return { disciplineTitle, el, fetchJSON, postJSON, dayMonth, fullDate, dateTime, weekdayLong, weekdayShort, capitalize, plural, countdown, duration, updateBell, renderDay, renderLesson, setupGroup, changeLines, shortName, place, minutesBetween, KIND, BADGE, illustration, emptyState };
})();
