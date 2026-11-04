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

  // Карточка занятия. mark: 'now' | 'next' | undefined.
  function renderLesson(lesson, mark) {
    const card = el('article', `lesson lesson--${lesson.status}`);
    const body = el('div', 'lesson__body');

    const tags = el('div', 'lesson__tags');
    if (lesson.status !== 'normal') tags.append(el('span', 'badge badge--' + lesson.status, BADGE[lesson.status]));
    if (mark === 'now') tags.append(el('span', 'tag tag--now', 'Идёт сейчас'));
    if (mark === 'next') tags.append(el('span', 'tag', 'Следующая'));
    if (tags.childElementCount) body.append(tags);

    body.append(el('h3', 'lesson__title', lesson.discipline));

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
      el('h3', 'lesson__title', lesson.discipline),
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

    // Отметки «идёт сейчас» / «следующая» — только для сегодняшнего дня.
    let nowId = null;
    let nextId = null;
    if (date === data.now.date) {
      for (const { lesson } of items) {
        if (!lesson || lesson.status === 'cancelled') continue;
        if (lesson.time.start <= data.now.time && data.now.time < lesson.time.end) nowId = lesson.id;
        else if (!nextId && lesson.time.start > data.now.time) nextId = lesson.id;
      }
    }

    const list = el('div', 'lesson-list');
    for (const item of items) {
      if (item.ghost) list.append(renderMovedAway(item.ghost));
      else list.append(renderLesson(item.lesson, item.lesson.id === nowId ? 'now' : item.lesson.id === nextId ? 'next' : undefined));
    }
    return { list, count: items.length };
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

  return { el, fetchJSON, dayMonth, weekdayLong, capitalize, plural, renderDay, setupGroup };
})();
