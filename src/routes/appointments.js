'use strict';
// Запись на приём. Студент работает только со своими записями (id — из сессии),
// расписание дня и отметки — только у сотрудника.
const express = require('express');
const { requireAuth } = require('../access');
const A = require('../appointments');
const { nowInMoscow, isValidDate } = require('../dates');

const router = express.Router();
router.use('/appointments', requireAuth);

const send = (res, r) => (r.error ? res.status(r.status).json({ error: r.error }) : res.json(r));

function idFrom(req, res) {
  const id = Number(req.params.id);
  if (Number.isInteger(id) && id > 0) return id;
  res.status(404).json({ error: 'Запись не найдена' });
  return null;
}

function onlyStudent(req, res, next) {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Только для студентов' });
  next();
}

function onlyStaff(req, res, next) {
  if (req.user.role !== 'staff') return res.status(403).json({ error: 'Только для сотрудников деканата' });
  next();
}

router.get('/appointments', (req, res) => {
  const now = nowInMoscow();
  if (req.user.role !== 'staff') return res.json(A.studentView(req.user, now));
  const date = isValidDate(req.query.date) ? req.query.date : now.date;
  res.json(A.staffView(req.user, date, req.query.faculty, now));
});

router.get('/appointments/slots', onlyStudent, (req, res) => {
  if (!isValidDate(req.query.date)) return res.status(400).json({ error: 'Выберите дату' });
  send(res, A.slotsView(req.user, req.query.date, nowInMoscow()));
});

router.post('/appointments', onlyStudent, (req, res) => {
  const body = req.body || {};
  if (!isValidDate(body.date)) return res.status(400).json({ error: 'Выберите дату' });
  send(res, A.book(req.user, body, nowInMoscow()));
});

router.post('/appointments/:id/reschedule', onlyStudent, (req, res) => {
  const id = idFrom(req, res);
  if (id === null) return;
  const body = req.body || {};
  if (!isValidDate(body.date)) return res.status(400).json({ error: 'Выберите дату' });
  send(res, A.reschedule(req.user, id, body, nowInMoscow()));
});

router.post('/appointments/:id/cancel', onlyStudent, (req, res) => {
  const id = idFrom(req, res);
  if (id !== null) send(res, A.cancel(req.user, id, nowInMoscow()));
});

router.post('/appointments/:id/mark', onlyStaff, (req, res) => {
  const id = idFrom(req, res);
  if (id !== null) send(res, A.mark(id, (req.body || {}).result, nowInMoscow()));
});

module.exports = router;
