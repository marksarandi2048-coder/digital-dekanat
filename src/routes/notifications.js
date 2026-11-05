'use strict';
// Уведомления студента и объявления деканата.
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../access');
const N = require('../notifications');
const A = require('../announcements');
const { nowInMoscow, nowStamp, isValidDate } = require('../dates');

const router = express.Router();
router.use(['/notifications', '/announcements', '/announcement-audiences'], requireAuth);

const today = () => nowInMoscow().date;

function staffOnly(req, res, next) {
  if (req.user.role !== 'staff') return res.status(403).json({ error: 'Только для сотрудников деканата' });
  next();
}

const q = {
  byId: db.prepare('SELECT * FROM announcements WHERE id = ?'),
  insert: db.prepare(`
    INSERT INTO announcements (author_id, title, body, important, faculty, course, group_name, deadline_on, created_at)
    VALUES (@author_id, @title, @body, @important, @faculty, @course, @group_name, @deadline_on, @created_at)`),
  remove: db.prepare('UPDATE announcements SET removed_at = ? WHERE id = ? AND removed_at IS NULL'),
  groups: db.prepare('SELECT name, faculty FROM groups ORDER BY name'),
  faculties: db.prepare("SELECT DISTINCT faculty FROM groups UNION SELECT DISTINCT faculty FROM users WHERE role = 'student' ORDER BY 1"),
};

// ---------- Лента студента ----------
// Строится ТОЛЬКО для вошедшего пользователя: параметров «чья лента» нет вообще.
router.get('/notifications', (req, res) => {
  if (req.user.role !== 'student') return res.json({ role: req.user.role, items: [], deadlines: [], unread: 0 });
  const t = today();
  const items = N.feed(req.user, t);
  res.json({
    role: 'student',
    today: t,
    unread: items.filter((i) => !i.read).length,
    items,
    deadlines: N.deadlines(req.user, t).slice(0, 5),
  });
});

router.get('/notifications/count', (req, res) => {
  if (req.user.role !== 'student') return res.json({ role: req.user.role, count: 0 });
  res.json({ role: 'student', count: N.unreadCount(req.user, today()) });
});

router.post('/notifications/read', (req, res) => {
  if (req.user.role !== 'student') return res.json({ marked: 0 });
  const b = req.body || {};
  let keys;
  if (b.all === true) keys = N.feed(req.user, today()).map((i) => i.key);
  else if (Array.isArray(b.keys)) keys = b.keys.filter((k) => typeof k === 'string' && k.length <= 200).slice(0, 200);
  else return res.status(400).json({ error: 'Не указано, что отметить' });
  res.json({ marked: N.markRead(req.user, today(), keys) });
});

// ---------- Объявления ----------
// Варианты «кому» для формы сотрудника.
router.get('/announcement-audiences', staffOnly, (req, res) => {
  res.json({ faculties: q.faculties.all().map((r) => r.faculty), groups: q.groups.all(), courses: [1, 2, 3, 4, 5, 6] });
});

// Список для сотрудника — со счётчиком «прочитали X из Y».
router.get('/announcements', staffOnly, (req, res) => {
  res.json({ announcements: A.listWithStats() });
});

// Одно объявление. Студенту — только адресованное ему и не снятое;
// на чужое и несуществующее ответ одинаковый — «не найдено».
router.get('/announcements/:id', (req, res) => {
  const id = Number(req.params.id);
  const a = Number.isSafeInteger(id) && id > 0 ? q.byId.get(id) : undefined;
  if (!a || (req.user.role !== 'staff' && !N.audienceMatches(a, req.user))) {
    return res.status(404).json({ error: 'Объявление не найдено' });
  }
  if (req.user.role === 'student') N.markAnnouncementRead(req.user.id, a.id);
  res.json({ announcement: A.toAnnouncement(a) });
});

router.post('/announcements', staffOnly, (req, res) => {
  const b = req.body || {};
  const str = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max + 1);
  const title = str(b.title, 150);
  const body = str(b.body, 3000);
  if (!title) return res.status(400).json({ error: 'Напишите заголовок' });
  if (title.length > 150) return res.status(400).json({ error: 'Заголовок — до 150 символов' });
  if (!body) return res.status(400).json({ error: 'Напишите текст объявления' });
  if (body.length > 3000) return res.status(400).json({ error: 'Текст — до 3000 символов' });

  // Кому: проверяем по реальным спискам факультетов и групп.
  const faculties = q.faculties.all().map((r) => r.faculty);
  const groups = q.groups.all().map((g) => g.name);
  const target = { faculty: null, course: null, group_name: null };
  switch (b.audience) {
    case 'all':
      break;
    case 'faculty':
      if (!faculties.includes(b.faculty)) return res.status(400).json({ error: 'Выберите факультет' });
      target.faculty = b.faculty;
      break;
    case 'course': {
      const course = Number(b.course);
      if (!Number.isInteger(course) || course < 1 || course > 6) return res.status(400).json({ error: 'Выберите курс' });
      if (b.faculty && !faculties.includes(b.faculty)) return res.status(400).json({ error: 'Неизвестный факультет' });
      target.course = course;
      target.faculty = b.faculty || null;
      break;
    }
    case 'group':
      if (!groups.includes(b.group)) return res.status(400).json({ error: 'Выберите группу' });
      target.group_name = b.group;
      break;
    default:
      return res.status(400).json({ error: 'Выберите, кому адресовано объявление' });
  }

  let deadline = null;
  if (b.deadlineOn) {
    if (!isValidDate(b.deadlineOn)) return res.status(400).json({ error: 'Неверная дата срока' });
    if (b.deadlineOn < today()) return res.status(400).json({ error: 'Срок не может быть в прошлом' });
    deadline = b.deadlineOn;
  }

  const id = q.insert.run({
    author_id: req.user.id,
    title,
    body,
    important: b.important === true ? 1 : 0,
    ...target,
    deadline_on: deadline,
    created_at: nowStamp(),
  }).lastInsertRowid;
  res.status(201).json({ id });
});

router.post('/announcements/:id/remove', staffOnly, (req, res) => {
  const id = Number(req.params.id);
  const changed = Number.isSafeInteger(id) ? q.remove.run(nowStamp(), id).changes : 0;
  if (!changed) return res.status(404).json({ error: 'Объявление не найдено или уже снято' });
  res.json({ ok: true });
});

module.exports = router;
