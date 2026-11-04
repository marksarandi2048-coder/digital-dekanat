'use strict';
// Расписание: сегодня и неделя.
const express = require('express');
const { requireAuth } = require('../access');
const { getSchedule, listGroups, PAIRS } = require('../schedule');
const { nowInMoscow, isValidDate, addDays, mondayOf } = require('../dates');

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
  const data = group ? getSchedule(group, now.date, now.date) : { lessons: [], movedAway: [] };
  res.json({ group, groups, now, date: now.date, pairs: PAIRS, ...data });
});

router.get('/schedule/week', (req, res) => {
  const { group, groups } = resolveGroup(req);
  const now = nowInMoscow();
  const base = isValidDate(req.query.start) ? req.query.start : now.date;
  const weekStart = mondayOf(base);
  const weekEnd = addDays(weekStart, 6);
  const data = group ? getSchedule(group, weekStart, weekEnd) : { lessons: [], movedAway: [] };
  res.json({
    group,
    groups,
    now,
    weekStart,
    weekEnd,
    prevWeek: addDays(weekStart, -7),
    nextWeek: addDays(weekStart, 7),
    isCurrentWeek: weekStart === mondayOf(now.date),
    pairs: PAIRS,
    ...data,
  });
});

module.exports = router;
