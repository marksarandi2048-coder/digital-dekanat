'use strict';
// Запись на приём в деканат. Слоты по 15 минут строятся из расписания факультета
// (src/faculties.js). Занятость и «одна запись на день» дополнительно защищены
// уникальными индексами в базе, поэтому одновременные нажатия не создадут дубль.
const { db } = require('./db');
const { nowStamp, addDays } = require('./dates');
const { deanOffice, faculties } = require('./faculties');

const SLOT_MIN = 15;
const WINDOW_DAYS = 14; // на сколько дней вперёд можно записаться
const COMMENT_MAX = 200;
const TOPICS = {
  certificates: 'Справки',
  academic_debt: 'Академическая задолженность',
  transfer: 'Перевод',
  other: 'Другое',
};

const q = {
  taken: db.prepare("SELECT date, time, student_id FROM appointments WHERE faculty = ? AND date BETWEEN ? AND ? AND status != 'cancelled'"),
  closed: db.prepare('SELECT date, reason FROM reception_closed_days WHERE faculty = ? AND date BETWEEN ? AND ?'),
  mine: db.prepare("SELECT * FROM appointments WHERE student_id = ? AND status = 'active' AND date >= ? ORDER BY date, time"),
  one: db.prepare('SELECT * FROM appointments WHERE id = ?'),
  insert: db.prepare(`
    INSERT INTO appointments (student_id, faculty, date, time, topic, comment, status, created_at, updated_at)
    VALUES (@student_id, @faculty, @date, @time, @topic, @comment, 'active', @at, @at)`),
  move: db.prepare("UPDATE appointments SET date = ?, time = ?, updated_at = ? WHERE id = ? AND status = 'active'"),
  cancel: db.prepare("UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'active'"),
  mark: db.prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?'),
  day: db.prepare(`
    SELECT a.*, u.full_name, u.group_name FROM appointments a JOIN users u ON u.id = a.student_id
    WHERE a.faculty = ? AND a.date = ? AND a.status != 'cancelled' ORDER BY a.time`),
  tomorrow: db.prepare("SELECT * FROM appointments WHERE student_id = ? AND date = ? AND status = 'active' ORDER BY time"),
};

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fail = (status, error) => ({ status, error });
const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 — воскресенье

// Все слоты дня по расписанию факультета; обед исключён. Пустой список — приёма нет.
function timesFor(faculty, date) {
  const { reception } = deanOffice(faculty);
  const hours = reception.days[weekdayOf(date)];
  if (!hours) return [];
  const [lunchFrom, lunchTo] = reception.lunch ? reception.lunch.map(toMin) : [0, 0];
  const out = [];
  for (let m = toMin(hours[0]); m + SLOT_MIN <= toMin(hours[1]); m += SLOT_MIN) {
    if (m < lunchTo && m + SLOT_MIN > lunchFrom) continue;
    out.push(toTime(m));
  }
  return out;
}

const isFuture = (date, time, now) => date > now.date || (date === now.date && time > now.time);
const windowEnd = (now) => addDays(now.date, WINDOW_DAYS - 1);
const inWindow = (date, now) => date >= now.date && date <= windowEnd(now);

function toItem(row, now) {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    topic: TOPICS[row.topic],
    comment: row.comment,
    status: row.status,
    place: deanOffice(row.faculty).reception.place,
    canChange: isFuture(row.date, row.time, now),
  };
}

// Страница студента: только его записи и дни его факультета.
function studentView(user, now) {
  const end = windowEnd(now);
  const taken = q.taken.all(user.faculty, now.date, end);
  const closed = new Map(q.closed.all(user.faculty, now.date, end).map((c) => [c.date, c.reason]));
  const mine = q.mine.all(user.id, now.date);
  const days = [];
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    const date = addDays(now.date, i);
    const times = timesFor(user.faculty, date).filter((t) => isFuture(date, t, now));
    if (!timesFor(user.faculty, date).length) continue;
    const busy = new Set(taken.filter((t) => t.date === date).map((t) => t.time));
    days.push({
      date,
      closed: closed.get(date) || null,
      free: times.filter((t) => !busy.has(t)).length,
      mine: mine.some((m) => m.date === date),
    });
  }
  return {
    role: 'student',
    topics: Object.entries(TOPICS).map(([id, label]) => ({ id, label })),
    commentMax: COMMENT_MAX,
    days,
    appointments: mine.map((m) => toItem(m, now)),
  };
}

function slotsView(user, date, now) {
  if (!inWindow(date, now)) return fail(400, 'На эту дату записаться нельзя');
  if (q.closed.all(user.faculty, date, date).length) return { date, slots: [] };
  const taken = q.taken.all(user.faculty, date, date);
  return {
    date,
    slots: timesFor(user.faculty, date).filter((t) => isFuture(date, t, now)).map((time) => {
      const holder = taken.find((x) => x.time === time);
      // Кто занял слот, в браузер не передаётся.
      return { time, state: !holder ? 'free' : holder.student_id === user.id ? 'mine' : 'busy' };
    }),
  };
}

// Можно ли занять это время: дата в окне, день приёмный и не закрыт, слот есть в расписании.
function slotError(faculty, date, time, now) {
  if (!inWindow(date, now)) return fail(400, 'На эту дату записаться нельзя');
  if (q.closed.all(faculty, date, date).length) return fail(409, 'В этот день приёма нет');
  if (typeof time !== 'string' || !timesFor(faculty, date).includes(time)) return fail(400, 'Такого времени нет в расписании приёма');
  if (!isFuture(date, time, now)) return fail(409, 'Это время уже прошло');
  return null;
}

// Ошибка уникальности из базы — понятным языком.
function uniqueError(err) {
  if (err.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw err;
  return err.message.includes('student') ? fail(409, 'На этот день у вас уже есть запись') : fail(409, 'Это время только что заняли — выберите другое');
}

function book(user, input, now) {
  const { date, time } = input;
  if (typeof input.topic !== 'string' || !Object.hasOwn(TOPICS, input.topic)) return fail(400, 'Выберите тему приёма');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, 'Выберите дату');
  const comment = typeof input.comment === 'string' ? input.comment.trim() : '';
  if (comment.length > COMMENT_MAX) return fail(400, `Комментарий длиннее ${COMMENT_MAX} символов`);
  const invalid = slotError(user.faculty, date, time, now);
  if (invalid) return invalid;
  try {
    const at = nowStamp();
    const { lastInsertRowid: id } = q.insert.run({ student_id: user.id, faculty: user.faculty, date, time, topic: input.topic, comment: comment || null, at });
    return { ok: true, appointment: toItem(q.one.get(id), now) };
  } catch (err) {
    return uniqueError(err);
  }
}

// Своя активная запись; на чужую и несуществующую ответ одинаковый.
function ownActive(user, id, now) {
  const row = q.one.get(id);
  if (!row || row.student_id !== user.id) return { error: fail(404, 'Запись не найдена') };
  if (row.status !== 'active') return { error: fail(409, 'Запись уже закрыта') };
  if (!isFuture(row.date, row.time, now)) return { error: fail(409, 'Приём уже начался — изменить запись нельзя') };
  return { row };
}

function reschedule(user, id, input, now) {
  const { row, error } = ownActive(user, id, now);
  if (error) return error;
  const { date, time } = input;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, 'Выберите дату');
  const invalid = slotError(row.faculty, date, time, now);
  if (invalid) return invalid;
  try {
    q.move.run(date, time, nowStamp(), row.id);
    return { ok: true, appointment: toItem(q.one.get(row.id), now) };
  } catch (err) {
    return uniqueError(err);
  }
}

function cancel(user, id, now) {
  const { row, error } = ownActive(user, id, now);
  if (error) return error;
  q.cancel.run(nowStamp(), row.id);
  return { ok: true };
}

// ---------- Сотрудник ----------
function staffView(user, date, askedFaculty, now) {
  const list = faculties();
  const names = list.map((f) => f.name);
  const faculty = names.includes(askedFaculty) ? askedFaculty : names.includes(user.faculty) ? user.faculty : names[0];
  const closed = q.closed.all(faculty, date, date)[0];
  return {
    role: 'staff',
    today: now.date,
    date,
    faculty,
    faculties: list,
    place: deanOffice(faculty).reception.place,
    reception: timesFor(faculty, date).length > 0,
    closed: closed ? closed.reason : null,
    canMark: date <= now.date,
    appointments: q.day.all(faculty, date).map((a) => ({ ...toItem(a, now), student: { fullName: a.full_name, group: a.group_name } })),
  };
}

const RESULTS = ['attended', 'missed'];

function mark(id, result, now) {
  if (!RESULTS.includes(result)) return fail(400, 'Неизвестная отметка');
  const row = q.one.get(id);
  if (!row) return fail(404, 'Запись не найдена');
  if (row.status === 'cancelled') return fail(409, 'Запись отменена');
  if (row.date > now.date) return fail(409, 'Отметить можно начиная с дня приёма');
  q.mark.run(result, nowStamp(), id);
  return { ok: true };
}

// Для ленты уведомлений: приёмы студента на завтра.
function reminders(user, today) {
  return q.tomorrow.all(user.id, addDays(today, 1)).map((a) => ({
    id: a.id, date: a.date, time: a.time, topic: TOPICS[a.topic], place: deanOffice(a.faculty).reception.place,
  }));
}

module.exports = { studentView, slotsView, book, reschedule, cancel, staffView, mark, reminders, timesFor };
