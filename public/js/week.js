'use strict';
// Страница «Неделя»: минимум на карточке, все детали — по нажатию.
// На телефоне — дни списком, на компьютере (CSS, от 1100 px) — сетка «пары × дни».
// Порядок в разметке один (день за днём) — так его читают программы экранного доступа;
// место в сетке задаётся через grid-row / grid-column.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');
  const sheet = document.getElementById('lesson-sheet');
  const sheetTitle = document.getElementById('sheet-title');
  const sheetBody = document.getElementById('sheet-body');

  // Значки изменений — свои, в одном стиле (эмодзи на разных телефонах выглядят по-разному).
  const ICONS = {
    moved: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    cancelled: '<path d="M6 6l12 12M18 6L6 18"/>',
    teacher_changed: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    room_changed: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  };
  const LABEL = {
    moved: 'Перенесено',
    moved_away: 'Перенесено отсюда',
    cancelled: 'Отменено',
    teacher_changed: 'Замена преподавателя',
    room_changed: 'Другая аудитория',
  };

  function statusIcon(kind) {
    const icon = el('span', `wk-icon wk-icon--${kind}`);
    const svg = el('span');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[kind === 'moved_away' ? 'moved' : kind]}</svg>`;
    icon.title = LABEL[kind];
    icon.append(svg, el('span', 'visually-hidden', LABEL[kind]));
    return icon;
  }

  function addDays(dateStr, n) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  const roomText = (room) => (/^\d+[а-яА-Яa-zA-Z]?$/.test(room) ? `ауд. ${room}` : room);
  const slotText = (date, pair, time) => `${D.capitalize(D.weekdayShort(date))}, ${D.dayMonth(date)}, ${pair} пара${time ? ` (${time.start}–${time.end})` : ''}`;

  // Ссылка на другую неделю с сохранением выбранной группы.
  function weekLink(start) {
    const params = new URLSearchParams(window.location.search);
    if (start) params.set('start', start);
    else params.delete('start');
    const qs = params.toString();
    return `/week${qs ? `?${qs}` : ''}`;
  }

  // ---------- Карточка пары: полоска цвета, время, короткое название, аудитория ----------
  function card(lesson, ghost) {
    const kind = ghost ? 'moved_away' : lesson.status;
    const btn = el('button', `wk-card disc-c${Number.isInteger(lesson.color) ? lesson.color : 0}${kind !== 'normal' ? ` wk-card--${kind}` : ''}`);
    btn.type = 'button';
    const pair = ghost ? lesson.change.oldPair : lesson.pair;
    const time = ghost ? lesson.change.oldTime : lesson.time;

    const top = el('span', 'wk-card__top');
    top.append(el('span', 'wk-card__time', time ? time.start : `${pair} пара`));
    if (kind !== 'normal') top.append(statusIcon(kind));
    btn.append(top, el('span', 'wk-card__name', lesson.shortName || lesson.discipline));
    if (!ghost) btn.append(el('span', 'wk-card__room', roomText(lesson.room)));

    // Полное описание для программ экранного доступа.
    const parts = [lesson.discipline, time ? `${time.start}–${time.end}` : `${pair} пара`];
    if (!ghost) parts.push(D.place(lesson.building, lesson.room));
    if (kind !== 'normal') parts.push(LABEL[kind]);
    btn.setAttribute('aria-label', `${parts.join(', ')}. Подробнее`);
    btn.addEventListener('click', () => openSheet(lesson, ghost));
    return btn;
  }

  // ---------- Панель с деталями ----------
  function row(dl, term, value, changed) {
    if (!value) return;
    dl.append(el('dt', null, term), el('dd', changed ? 'is-changed' : null, value));
  }

  function openSheet(lesson, ghost) {
    sheetTitle.replaceChildren();
    sheetTitle.append(D.disciplineTitle('span', 'sheet__name', lesson.discipline, lesson.color));

    const body = [];
    const kind = ghost ? 'moved_away' : lesson.status;
    if (kind !== 'normal') {
      const badge = el('span', `badge badge--${ghost ? 'moved' : lesson.status} sheet__badge`);
      badge.append(statusIcon(kind), document.createTextNode(LABEL[kind]));
      body.push(badge);
    }

    const dl = el('dl', 'sheet__facts');
    if (ghost) {
      row(dl, 'Было', slotText(lesson.change.oldDate, lesson.change.oldPair, lesson.change.oldTime));
      row(dl, 'Теперь', slotText(lesson.date, lesson.pair, lesson.time), true);
      row(dl, 'Где', D.place(lesson.building, lesson.room));
    } else {
      row(dl, 'Когда', slotText(lesson.date, lesson.pair, lesson.time), lesson.status === 'moved');
      row(dl, 'Где', D.place(lesson.building, lesson.room), lesson.status === 'room_changed');
    }
    row(dl, 'Преподаватель', `${lesson.teacher}${lesson.teacherTitle ? `, ${lesson.teacherTitle}` : ''}`, lesson.status === 'teacher_changed');
    row(dl, 'Занятие', D.KIND[lesson.kind]);
    body.push(dl);

    // Что изменилось и почему.
    const c = lesson.change;
    if (c) {
      const box = el('section', 'sheet__change');
      box.append(el('h3', 'sheet__subtitle', 'Что изменилось'));
      const lines = [];
      if (lesson.status === 'cancelled') lines.push('Пара отменена.');
      if (lesson.status === 'moved' && !ghost) lines.push(`Перенесена с: ${slotText(c.oldDate, c.oldPair, c.oldTime)}.`);
      if (ghost) lines.push(`Пара перенесена на ${slotText(lesson.date, lesson.pair, lesson.time)}.`);
      if (lesson.status === 'teacher_changed') lines.push(`Вместо: ${c.oldTeacher}.`);
      if (lesson.status === 'room_changed') lines.push(`Было: ${D.place(c.oldBuilding, c.oldRoom)}.`);
      for (const line of lines) box.append(el('p', null, line));
      if (c.note) box.append(el('p', 'sheet__reason', `Причина: ${c.note}`));
      if (c.changedAt) box.append(el('p', 'muted sheet__when', `Сообщено ${D.dateTime(c.changedAt)}`));
      body.push(box);
    }

    sheetBody.replaceChildren(...body);
    sheet.showModal();
  }

  document.getElementById('sheet-close').addEventListener('click', () => sheet.close());
  // Нажатие мимо панели (по затемнению) закрывает её.
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close();
  });

  // ---------- Неделя ----------
  async function load() {
    const params = new URLSearchParams(window.location.search);
    const api = new URLSearchParams();
    if (params.get('start')) api.set('start', params.get('start'));
    if (params.get('group')) api.set('group', params.get('group'));

    let data;
    try {
      data = await D.fetchJSON(`/api/schedule/week?${api}`);
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }

    D.setupGroup(data);
    if (data.groups && data.group) {
      document.getElementById('ics-link').href = `/api/schedule/calendar.ics?group=${encodeURIComponent(data.group)}`;
    }

    // Переключатель недель.
    document.getElementById('week-label').textContent = `${D.dayMonth(data.weekStart)} – ${D.dayMonth(addDays(data.weekStart, 5))}`;
    document.getElementById('week-prev').href = weekLink(data.prevWeek);
    document.getElementById('week-next').href = weekLink(data.nextWeek);
    const current = document.getElementById('week-current');
    if (data.isCurrentWeek) current.replaceWith(el('span', 'week-nav__note', 'Текущая неделя'));
    else {
      current.href = weekLink(null);
      current.hidden = false;
    }

    const changes = data.lessons.filter((l) => l.status !== 'normal').length;
    const banner = document.getElementById('changes-banner');
    if (changes) {
      banner.textContent = `${changes} ${D.plural(changes, 'изменение', 'изменения', 'изменений')} на неделе — нажмите на пару, чтобы узнать подробности`;
      banner.hidden = false;
    }

    // Дни: пн–сб всегда, воскресенье — только если в нём есть занятия.
    const items = [
      ...data.lessons.map((l) => ({ date: l.date, pair: l.pair, lesson: l })),
      ...data.movedAway.map((l) => ({ date: l.change.oldDate, pair: l.change.oldPair, lesson: l, ghost: true })),
    ];
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(data.weekStart, i);
      if (i === 6 && !items.some((x) => x.date === date)) continue;
      days.push(date);
    }

    // Строки сетки — от первой до последней пары, которые есть на этой неделе.
    const pairs = items.map((x) => x.pair);
    const minPair = pairs.length ? Math.min(...pairs) : 1;
    const maxPair = pairs.length ? Math.max(...pairs) : 1;
    content.style.setProperty('--wk-days', String(days.length));
    content.style.setProperty('--wk-rows', String(maxPair - minPair + 1));
    const rowOf = (pair) => pair - minPair + 2; // строка 1 — названия дней

    const nodes = [];
    days.forEach((date, i) => {
      const col = i + 2; // колонка 1 — номера пар
      const isToday = date === data.now.date;
      const section = el('section', `wk-day${isToday ? ' wk-day--today' : ''}`);
      section.id = `day-${date}`;
      const head = el('h2', 'wk-day__title');
      head.append(el('span', 'wk-day__name', D.capitalize(D.weekdayShort(date))), el('span', 'wk-day__date', D.dayMonth(date)));
      if (isToday) head.append(el('span', 'tag tag--now', 'Сегодня'));
      head.style.gridColumn = String(col);
      section.append(head);

      const dayItems = items.filter((x) => x.date === date).sort((a, b) => a.pair - b.pair || (a.ghost ? 1 : -1));
      if (!dayItems.length) section.append(el('p', 'wk-day__empty', 'Занятий нет'));
      // Ячейка «день × пара»: в ней может быть пара и «след» перенесённой.
      for (const pair of [...new Set(dayItems.map((x) => x.pair))]) {
        const slot = el('div', 'wk-slot');
        slot.style.gridColumn = String(col);
        slot.style.gridRow = String(rowOf(pair));
        for (const x of dayItems.filter((y) => y.pair === pair)) slot.append(card(x.lesson, x.ghost));
        section.append(slot);
      }

      if (isToday) {
        const band = el('div', 'wk-today-band');
        band.setAttribute('aria-hidden', 'true');
        band.style.gridColumn = String(col);
        nodes.push(band);
      }
      nodes.push(section);
    });

    // Номера пар и время — слева в сетке (только на широком экране).
    for (let p = minPair; p <= maxPair; p += 1) {
      const time = data.pairs && data.pairs[p];
      const line = el('div', 'wk-row');
      line.setAttribute('aria-hidden', 'true');
      line.style.gridRow = String(rowOf(p));
      line.append(el('span', 'wk-row__pair', `${p} пара`));
      if (time) line.append(el('span', 'wk-row__time', `${time.start}–${time.end}`));
      nodes.push(line);
    }

    content.replaceChildren(...nodes);
    loading.hidden = true;
    content.hidden = false;

    // Пришли из уведомления (…#day-ГГГГ-ММ-ДД) — показываем нужный день.
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (target) {
      target.classList.add('wk-day--focus');
      target.scrollIntoView({ block: 'start' });
    }
  }

  load();
})();
