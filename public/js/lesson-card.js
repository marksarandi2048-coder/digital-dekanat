'use strict';
// Минимальная карточка пары и панель с деталями — общие для «Сегодня» и «Недели».
// На странице должен быть <dialog id="lesson-sheet"> (панель справа / шторка снизу).
window.DekanatLesson = (function () {
  const D = window.Dekanat;
  const el = D.el;
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

  const roomText = (room) => (/^\d+[а-яА-Яa-zA-Z]?$/.test(room) ? `ауд. ${room}` : room);
  const slotText = (date, pair, time) => `${D.capitalize(D.weekdayShort(date))}, ${D.dayMonth(date)}, ${pair} пара${time ? ` (${time.start}–${time.end})` : ''}`;

  // ---------- Карточка пары: полоска цвета, время, короткое название, аудитория ----------
  // showEnd — показать время целиком («09:00–10:20»), а не только начало.
  function card(lesson, ghost, { showEnd = false } = {}) {
    const kind = ghost ? 'moved_away' : lesson.status;
    const btn = el('button', `wk-card disc-c${Number.isInteger(lesson.color) ? lesson.color : 0}${kind !== 'normal' ? ` wk-card--${kind}` : ''}`);
    btn.type = 'button';
    const pair = ghost ? lesson.change.oldPair : lesson.pair;
    const time = ghost ? lesson.change.oldTime : lesson.time;

    const top = el('span', 'wk-card__top');
    const shown = time ? (showEnd ? `${time.start}–${time.end}` : time.start) : `${pair} пара`;
    top.append(el('span', 'wk-card__time', shown));
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

  return { card, roomText };
})();
