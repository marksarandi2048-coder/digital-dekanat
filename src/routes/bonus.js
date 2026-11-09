'use strict';
// Надбавка. Студент работает только со своими записями (id — из сессии),
// подтверждать и начислять может только сотрудник.
const express = require('express');
const { requireAuth } = require('../access');
const B = require('../bonus');
const { nowInMoscow } = require('../dates');

const router = express.Router();
router.use('/bonus', requireAuth);

const today = () => nowInMoscow().date;
const send = (res, result) => (result.error ? res.status(result.status).json({ error: result.error }) : res.json({ ok: true }));

// Номер из адреса: только целое положительное число.
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

router.get('/bonus', (req, res) => {
  res.json(req.user.role === 'staff' ? B.staffView() : B.studentView(req.user, today()));
});

router.post('/bonus/opportunities/:id/enroll', onlyStudent, (req, res) => {
  const id = idFrom(req, res);
  if (id !== null) send(res, B.enroll(req.user, id, today()));
});

router.post('/bonus/enrollments/:id/cancel', onlyStudent, (req, res) => {
  const id = idFrom(req, res);
  if (id !== null) send(res, B.cancel(req.user, id));
});

router.post('/bonus/enrollments/:id/status', onlyStaff, (req, res) => {
  const id = idFrom(req, res);
  if (id !== null) send(res, B.act(id, (req.body || {}).action, today()));
});

module.exports = router;
