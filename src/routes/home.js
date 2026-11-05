'use strict';
// «Главная»: короткая сводка по всем разделам для плиток.
// Всё строится ТОЛЬКО для вошедшего пользователя (из сессии) — параметров «чья главная» нет.
const express = require('express');
const { requireAuth } = require('../access');
const { getSchedule } = require('../schedule');
const { listSemesters, semesterData } = require('../grades');
const N = require('../notifications');
const R = require('../requests');
const A = require('../announcements');
const { nowInMoscow, addDays } = require('../dates');

const router = express.Router();

const LOOK_AHEAD_DAYS = 14; // где искать следующую пару, если сегодня их больше нет
const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const notCancelled = (l) => l.status !== 'cancelled';

// «Аксёнова Вероника Игоревна» → «Вероника»
const firstName = (fullName) => fullName.split(/\s+/)[1] || fullName;

// ---------- Пара: сейчас идёт / следующая / следующий учебный день ----------
function scheduleTile(group, now) {
  if (!group) return null;
  const today = getSchedule(group, now.date, now.date);
  const real = today.lessons.filter(notCancelled);
  const t = toMinutes(now.time);
  const current = real.find((l) => toMinutes(l.time.start) <= t && t < toMinutes(l.time.end));
  const next = real.find((l) => toMinutes(l.time.start) > t);
  const tile = {
    group,
    todayCount: real.length,
    changes: today.lessons.filter((l) => l.status !== 'normal').length + today.movedAway.length,
    current: current ? { lesson: current, left: toMinutes(current.time.end) - t } : null,
    next: next ? { lesson: next, in: toMinutes(next.time.start) - t } : null,
    upcoming: null,
  };
  if (!current && !next) {
    const later = getSchedule(group, addDays(now.date, 1), addDays(now.date, LOOK_AHEAD_DAYS)).lessons.filter(notCancelled);
    if (later.length) {
      const date = later[0].date;
      tile.upcoming = { date, lesson: later[0], count: later.filter((l) => l.date === date).length };
    }
  }
  return tile;
}

// ---------- Успеваемость за текущий семестр ----------
function ratingTile(user, today) {
  const semester = listSemesters(today).find((s) => s.isCurrent);
  if (!semester) return null;
  const { rating, summary } = semesterData(user, semester.id, today);
  return {
    semester: semester.name,
    soFar: rating.soFar,
    total: rating.total,
    max: rating.max,
    bonus: rating.bonus,
    isFinal: summary.isFinal,
    debts: summary.debts.length,
    overdue: summary.overdue,
    pending: summary.pending,
  };
}

function studentHome(user, now) {
  const today = now.date;

  // Ближайший дедлайн: сначала то, что должен сделать сам студент.
  const deadlines = N.deadlines(user, today);
  const deadline = deadlines.find((d) => d.own) || deadlines[0] || null;

  const requests = R.listForStudent(user.id).map(R.toListItem);

  const unread = N.feed(user, today).filter((i) => !i.read);
  const latest = unread[0];

  return {
    role: 'student',
    firstName: firstName(user.full_name),
    now,
    schedule: scheduleTile(user.group_name, now),
    deadline: deadline && { ...deadline, more: deadlines.filter((d) => d.own).length - 1 },
    rating: ratingTile(user, today),
    request: requests[0] || null,
    activeRequests: requests.filter((r) => !r.closed).length,
    notifications: {
      unread: unread.length,
      important: unread.filter((i) => i.important).length,
      latest: latest ? { title: latest.title, kindLabel: latest.kindLabel, important: latest.important, link: latest.link } : null,
    },
  };
}

function staffHome(user, now) {
  // Открытые — те, с которыми ещё что-то нужно сделать (готовая электронная справка уже закрыта).
  const open = R.listAll(null).map(R.toListItem).filter((r) => !r.closed);
  const count = (status) => open.filter((r) => r.status === status).length;
  return {
    role: 'staff',
    firstName: firstName(user.full_name),
    now,
    counts: { accepted: count('accepted'), inProgress: count('in_progress'), ready: count('ready') },
    openRequests: open.slice(0, 5),
    openTotal: open.length,
    announcements: A.listWithStats().filter((a) => !a.removed).slice(0, 3),
  };
}

router.get('/home', requireAuth, (req, res) => {
  const now = nowInMoscow();
  res.json(req.user.role === 'staff' ? staffHome(req.user, now) : studentHome(req.user, now));
});

module.exports = router;
