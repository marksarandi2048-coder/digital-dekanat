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

    const c = lesson.change;
    if (c) {
      const lines = [];
      if (lesson.status === 'moved') lines.push(`Было: ${slot(c.oldDate, c.oldPair, c.oldTime)}`);
      if (lesson.status === 'teacher_changed') lines.push(`Вместо: ${shortName(c.oldTeacher)}`);
      if (lesson.status === 'room_changed') lines.push(`Было: ${place(c.oldBuilding, c.oldRoom)}`);
      if (c.note) lines.push(c.note);
      for (const line of lines) body.append(el('p', 'lesson__change', line));
    }

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

  // ---------- Обратный отсчёт: «сегодня», «завтра», «через 3 дня» ----------
  function countdown(days) {
    if (days <= 0) return 'сегодня';
    if (days === 1) return 'завтра';
    return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
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
    if (data.role === 'staff') {
      bell.href = '/announcements';
      bell.setAttribute('aria-label', 'Объявления');
      return;
    }
    const n = data.count || 0;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = n === 0;
    bell.setAttribute('aria-label', n ? `Уведомления: ${n} ${plural(n, 'непрочитанное', 'непрочитанных', 'непрочитанных')}` : 'Уведомления');
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

  return { disciplineTitle, el, fetchJSON, postJSON, dayMonth, fullDate, dateTime, weekdayLong, capitalize, plural, countdown, updateBell, renderDay, setupGroup };
})();
