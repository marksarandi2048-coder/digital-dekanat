'use strict';
const { tr, currentLocale } = require('../i18n');
const { dataText } = require('../dataEn');
// Расписание: сегодня и неделя.
const express = require('express');
const { requireAuth } = require('../access');
const { getSchedule, lunchForGroup, listGroups } = require('../schedule');
const { bringFor } = require('../bringRules');
const { nowInMoscow, isValidDate, addDays, mondayOf, switcherWeek } = require('../dates');
const { listSemesters } = require('../grades');
const { buildCalendar } = require('../ics');

const router = express.Router();
router.use('/schedule', requireAuth);

// Чьё расписание показывать.
// Студент — ТОЛЬКО своей группы из профиля; параметр ?group= для него игнорируется.
// Сотрудник — любой группы из списка (по умолчанию первой).
function resolveGroup(req) {
  if (req.user.role === 'student') return { group: req.user.group_name };
  const groups = listGroups();
  const asked = typeof req.query.group === 'string' ? req.query.group : '';
  return { group: groups.includes(asked) ? asked : groups[0] || null, groups };
}

router.get('/schedule/today', (req, res) => {
  const { group, groups } = resolveGroup(req);
  const now = nowInMoscow();
  // ?date= — другой день в переключателе. Группа всё равно определяется выше, по сессии.
  const date = isValidDate(req.query.date) ? req.query.date : now.date;
  const data = group ? getSchedule(group, date, date) : { pairs: null, lessons: [], movedAway: [] };
  const lunch = group ? lunchForGroup(group) : null;
  // «Что взять с собой» — подсказка студенту; сотруднику на занятия идти не нужно.
  const bring = req.user.role === 'student' ? bringFor(data.lessons) : [];
  res.json({ group, groups, now, date, today: now.date, week: switcherWeek(now.date), lunch, bring, ...data });
});

router.get('/schedule/week', (req, res) => {
  const { group, groups } = resolveGroup(req);
  const now = nowInMoscow();
  const base = isValidDate(req.query.start) ? req.query.start : now.date;
  const weekStart = mondayOf(base);
  const weekEnd = addDays(weekStart, 6);
  const data = group ? getSchedule(group, weekStart, weekEnd) : { pairs: null, lessons: [], movedAway: [] };
  // Только расписание студента можно хранить на устройстве для работы без сети.
  if (req.user.role === 'student') res.set('X-Offline-Allowed', '1');
  res.json({
    group,
    groups,
    now,
    weekStart,
    weekEnd,
    prevWeek: addDays(weekStart, -7),
    nextWeek: addDays(weekStart, 7),
    isCurrentWeek: weekStart === mondayOf(now.date),
    ...data,
  });
});

// Файл .ics с занятиями на текущий семестр — «Добавить в календарь телефона».
// Группа — как везде: студенту только своя (из сессии), сотруднику — выбранная.
router.get('/schedule/calendar.ics', (req, res) => {
  const { group } = resolveGroup(req);
  if (!group) return res.status(404).json({ error: tr('schedule.raspisanie_ne_naydeno') });
  const today = nowInMoscow().date;
  const semester = listSemesters(today).find((s) => s.isCurrent);
  const from = semester ? semester.startsOn : today;
  const to = semester ? semester.endsOn : addDays(today, 120);
  const { lessons, pairs } = getSchedule(group, from, to);
  const fmt = (d) => new Intl.DateTimeFormat(currentLocale(), { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long' }).format(new Date(`${d}T00:00:00Z`));
  const body = buildCalendar({ group, lessons, fmtSlot: (date, pair) => tr('schedule.p0_pair_para_start', { p0: fmt(date), pair, start: pairs[pair].start }) });

  // Запасное имя файла латиницей (для старых браузеров): МЭО-3-07 → MEO-3-07.
  const LAT = { А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'E', Ж: 'Zh', З: 'Z', И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'Kh', Ц: 'Ts', Ч: 'Ch', Ш: 'Sh', Щ: 'Sch', Ы: 'Y', Э: 'E', Ю: 'Yu', Я: 'Ya' };
  const latin = [...group.toUpperCase()].map((c) => LAT[c] ?? c).join('').replace(/[^A-Za-z0-9-]/g, '');
  const ascii = `raspisanie-${latin || 'gruppa'}.ics`;
  res.set({
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(tr('schedule.raspisanie_group_ics', { group: dataText(group) }))}`,
  });
  res.send(body);
});

module.exports = router;
