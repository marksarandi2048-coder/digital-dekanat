'use strict';
const { tr } = require('../i18n');
// Успеваемость.
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../access');
const { findById } = require('../users');
const { listSemesters, semesterData } = require('../grades');
const { forecast } = require('../forecast');
const { nowInMoscow } = require('../dates');

const router = express.Router();

const studentsQuery = db.prepare(
  "SELECT id, full_name, group_name FROM users WHERE role = 'student' ORDER BY full_name",
);

// Чью успеваемость показывать.
// Студент — ТОЛЬКО свою: id берётся из сессии, параметр ?student= игнорируется.
// Сотрудник — любого студента (только просмотр).
function resolveStudent(req) {
  if (req.user.role === 'student') return { student: req.user };
  const students = studentsQuery.all();
  const askedId = Number(req.query.student);
  const asked = students.find((s) => s.id === askedId) || students[0];
  return {
    student: asked ? findById(asked.id) : null,
    students: students.map((s) => ({ id: s.id, fullName: s.full_name, group: s.group_name })),
  };
}

router.get('/grades', requireAuth, (req, res) => {
  const { student, students } = resolveStudent(req);
  const today = nowInMoscow().date;
  const semesters = listSemesters(today);
  if (!student || !semesters.length) {
    return res.json({ today, students, student: null, semesters, semester: null });
  }

  const askedSemester = semesters.find((s) => s.id === Number(req.query.semester));
  const semester = askedSemester || semesters.find((s) => s.isCurrent) || semesters[0];
  const data = semesterData(student, semester.id, today);

  // Для сравнения — итог предыдущего семестра.
  const idx = semesters.findIndex((s) => s.id === semester.id);
  const prevSemester = semesters[idx + 1];
  const previous = prevSemester
    ? { id: prevSemester.id, name: prevSemester.name, ...pickPrev(semesterData(student, prevSemester.id, today)) }
    : null;

  res.json({
    today,
    students,
    student: { id: student.id, fullName: student.full_name, group: student.group_name },
    semesters,
    semester,
    previous,
    ...data,
  });
});

// Калькулятор «Что нужно на экзамене»: только для самого студента, студент — из сессии.
// Метод POST — потому что выбор оценок передаётся в теле запроса; в базу ничего не пишется.
router.post('/grades/forecast', requireAuth, (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: tr('grades.kalkulyator_dostupen_tolko_studentu') });
  const result = forecast(req.user, nowInMoscow().date, req.body || {});
  if (!result) return res.status(404).json({ error: tr('grades.tekuschiy_semestr_ne_nayden') });
  res.json(result);
});

function pickPrev(d) {
  return { total: d.rating.total, isFinal: d.summary.isFinal };
}

module.exports = router;
