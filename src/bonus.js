'use strict';
// «Где заработать надбавку»: возможности, записи студентов и начисление баллов.
// Начисленные баллы попадают в таблицу bonuses — оттуда их берёт настоящий рейтинг.
const { db } = require('./db');
const { nowStamp, addDays } = require('./dates');
const { listSemesters, semesterData } = require('./grades');
const { MAX } = require('./rating');

const SELECT_ENROLLMENT = `
  SELECT e.*, o.title, o.category, o.points, u.full_name, u.group_name
  FROM bonus_enrollments e
  JOIN bonus_opportunities o ON o.id = e.opportunity_id
  JOIN users u ON u.id = e.student_id`;

const q = {
  opportunities: db.prepare('SELECT * FROM bonus_opportunities ORDER BY signup_until, id'),
  opportunity: db.prepare('SELECT * FROM bonus_opportunities WHERE id = ?'),
  mine: db.prepare(`${SELECT_ENROLLMENT} WHERE e.student_id = ? ORDER BY e.updated_at DESC, e.id DESC`),
  all: db.prepare(`${SELECT_ENROLLMENT} ORDER BY e.updated_at DESC, e.id DESC`),
  one: db.prepare(`${SELECT_ENROLLMENT} WHERE e.id = ?`),
  exists: db.prepare('SELECT id FROM bonus_enrollments WHERE opportunity_id = ? AND student_id = ?'),
  insert: db.prepare(`
    INSERT INTO bonus_enrollments (opportunity_id, student_id, status, created_at, updated_at)
    VALUES (?, ?, 'submitted', ?, ?)`),
  cancel: db.prepare("DELETE FROM bonus_enrollments WHERE id = ? AND student_id = ? AND status = 'submitted'"),
  move: db.prepare('UPDATE bonus_enrollments SET status = @to, updated_at = @at, bonus_id = @bonusId WHERE id = @id AND status = @from'),
  addBonus: db.prepare(`
    INSERT INTO bonuses (student_id, semester_id, category, title, points, awarded_on)
    VALUES (?, ?, ?, ?, ?, ?)`),
};

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const round1 = (n) => Math.round(n * 10) / 10;
const fail = (status, error) => ({ status, error });

function toItem(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    points: row.points,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Страница студента: прогресс, лента и только СВОИ записи.
function studentView(user, today) {
  const semester = listSemesters(today).find((s) => s.isCurrent);
  const block = semester ? semesterData(user, semester.id, today).rating.blocks.find((b) => b.key === 'bonus') : { points: 0, max: MAX.bonus };
  const mine = q.mine.all(user.id);
  const byOpportunity = new Map(mine.map((e) => [e.opportunity_id, e]));
  const pending = mine.filter((e) => e.status === 'submitted' || e.status === 'confirmed').reduce((s, e) => s + e.points, 0);
  const room = round1(Math.max(0, block.max - block.points - pending)); // сколько ещё поместится в максимум

  const opportunities = q.opportunities.all().map((o) => ({
    id: o.id,
    category: o.category,
    title: o.title,
    description: o.description,
    organizer: o.organizer,
    points: o.points,
    signupUntil: o.signup_until,
    eventOn: o.event_on,
    open: o.signup_until >= today,
    daysLeft: daysBetween(today, o.signup_until),
    status: byOpportunity.get(o.id)?.status || null,
    room: o.points > room ? room : null, // не null — в рейтинг пойдёт только часть баллов
  })).sort((a, b) => Number(b.open) - Number(a.open));

  return {
    role: 'student',
    progress: { points: block.points, max: block.max, left: round1(Math.max(0, block.max - block.points)) },
    opportunities,
    mine: mine.map(toItem),
  };
}

function staffView() {
  return {
    role: 'staff',
    enrollments: q.all.all().map((e) => ({ ...toItem(e), student: { fullName: e.full_name, group: e.group_name } })),
  };
}

function enroll(user, opportunityId, today) {
  const o = q.opportunity.get(opportunityId);
  if (!o) return fail(404, 'Такой возможности нет');
  if (o.signup_until < today) return fail(409, 'Запись уже закончилась');
  if (q.exists.get(o.id, user.id)) return fail(409, 'Вы уже записаны');
  const at = nowStamp();
  q.insert.run(o.id, user.id, at, at);
  return { ok: true };
}

// Отменить можно только свою запись и только пока заявка не подтверждена.
// На чужую и на несуществующую запись ответ одинаковый.
function cancel(user, id) {
  if (q.cancel.run(id, user.id).changes) return { ok: true };
  const row = q.one.get(id);
  if (row && row.student_id === user.id) return fail(409, 'Запись уже подтверждена — отменить её может только деканат');
  return fail(404, 'Запись не найдена');
}

// Разрешён только следующий шаг: перескочить или вернуться назад нельзя.
const ACTIONS = {
  confirm: { from: ['submitted'], to: 'confirmed' },
  award: { from: ['confirmed'], to: 'awarded' },
  reject: { from: ['submitted', 'confirmed'], to: 'rejected' },
};

const act = db.transaction((id, action, today) => {
  const rule = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : null;
  if (!rule) return fail(400, 'Неизвестное действие');
  const row = q.one.get(id);
  if (!row) return fail(404, 'Запись не найдена');
  if (!rule.from.includes(row.status)) return fail(409, 'Этот шаг сейчас недоступен: обновите страницу');

  let bonusId = row.bonus_id;
  if (action === 'award') {
    const semester = listSemesters(today).find((s) => s.isCurrent);
    if (!semester) return fail(409, 'Текущий семестр не найден');
    bonusId = q.addBonus.run(row.student_id, semester.id, row.category, row.title, row.points, today).lastInsertRowid;
  }
  q.move.run({ id, from: row.status, to: rule.to, at: nowStamp(), bonusId });
  return { ok: true };
});

// Для ленты уведомлений: что изменил деканат за последние дни.
const eventsQuery = db.prepare(`
  SELECT e.id, e.status, e.updated_at, o.title, o.points
  FROM bonus_enrollments e JOIN bonus_opportunities o ON o.id = e.opportunity_id
  WHERE e.student_id = ? AND e.status IN ('confirmed', 'awarded', 'rejected') AND e.updated_at >= ?`);

function eventsFor(userId, today, days) {
  return eventsQuery.all(userId, `${addDays(today, -days)} 00:00`);
}

module.exports = { studentView, staffView, enroll, cancel, act, eventsFor };
