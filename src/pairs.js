'use strict';
// Расписание звонков. Пара — 80 минут. На большинстве факультетов обед
// после 2-й пары; на некоторых (например, ФМО) 3-я пара раньше, а обед — после неё.
// Время каждой пары задаётся здесь, в базе хранится только номер пары.

const STANDARD = {
  1: { start: '09:00', end: '10:20' },
  2: { start: '10:35', end: '11:55' },
  // обед 11:55–12:55
  3: { start: '12:55', end: '14:15' },
  4: { start: '14:30', end: '15:50' },
  5: { start: '16:00', end: '17:20' },
  6: { start: '17:30', end: '18:50' },
  7: { start: '19:00', end: '20:20' },
  8: { start: '20:30', end: '21:50' },
};

const EARLY_THIRD = {
  ...STANDARD,
  3: { start: '12:10', end: '13:30' },
  // обед 13:30–14:30
};

// Факультеты с ранней 3-й парой. Остальные — по стандартному расписанию.
const EARLY_THIRD_FACULTIES = new Set(['Факультет международных отношений']);

function pairsFor(faculty) {
  return EARLY_THIRD_FACULTIES.has(faculty) ? EARLY_THIRD : STANDARD;
}

// Обед: на большинстве факультетов после 2-й пары, на факультетах с ранней 3-й — после неё.
function lunchFor(faculty) {
  return EARLY_THIRD_FACULTIES.has(faculty)
    ? { start: '13:30', end: '14:30' }
    : { start: '11:55', end: '12:55' };
}

module.exports = { pairsFor, lunchFor };
