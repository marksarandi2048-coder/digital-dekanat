'use strict';
// Вымышленные записи на приём. Чтобы день у сотрудника выглядел заполненным, добавлены
// трое студентов только для этого списка: у них случайный пароль, войти за них нельзя.
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { addDays } = require('../src/dates');
const { timesFor } = require('../src/appointments');

const FMO = 'Факультет международных отношений';
const MEO = 'Факультет международных экономических отношений';

function seedAppointments({ db, now, userIdByLogin }) {
  const today = now.date;
  const addUser = db.prepare(`
    INSERT INTO users (login, password_hash, role, full_name, faculty, program, course, group_name)
    VALUES (?, ?, 'student', ?, ?, 'Международные отношения', 2, 'МО-2-03')`);
  const hash = () => bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 4);
  const extra = [
    ['demo.student1', 'Белова Дарья Сергеевна'],
    ['demo.student2', 'Горин Матвей Ильич'],
    ['demo.student3', 'Лисицына Полина Артёмовна'],
  ].map(([login, name]) => addUser.run(login, hash(), name, FMO).lastInsertRowid);

  const insert = db.prepare(`
    INSERT INTO appointments (student_id, faculty, date, time, topic, comment, status, created_at, updated_at)
    VALUES (@student, @faculty, @date, @time, @topic, @comment, @status, @at, @at)`);
  const closeDay = db.prepare('INSERT INTO reception_closed_days (faculty, date, reason) VALUES (?, ?, ?)');

  // Санитарный день из объявления деканата МЭО (seed-announcements).
  closeDay.run(MEO, addDays(today, 9), 'Санитарный день');

  // Ближайшие приёмные дни начиная с сегодняшнего.
  const receptionDays = (faculty, count) => {
    const out = [];
    for (let i = 0; out.length < count && i < 14; i += 1) {
      const date = addDays(today, i);
      if (timesFor(faculty, date).length) out.push(date);
    }
    return out;
  };
  const [dayFmo0, dayFmo1] = receptionDays(FMO, 2);
  const [dayMeo0, dayMeo1] = receptionDays(MEO, 2);
  const nextDay = (first, second) => (first > today ? first : second); // завтра или ближайший день после сегодня

  const add = (student, faculty, date, time, topic, status, comment = null) => insert.run({
    student, faculty, date, time, topic, comment, status: date > today && status !== 'active' ? 'active' : status, at: `${addDays(today, -1)} 12:00`,
  });
  // Заполненный день у сотрудника ФМО: пришёл, не пришёл, ожидается.
  add(extra[0], FMO, dayFmo0, '10:30', 'certificates', 'attended');
  add(extra[1], FMO, dayFmo0, '11:00', 'academic_debt', 'missed', 'Пересдача по истории МО');
  add(extra[2], FMO, dayFmo0, '15:30', 'transfer', 'active', 'Перевод на другое направление');
  // Запись у каждого из студентов, под которыми можно войти.
  add(userIdByLogin['v.aksenova'], FMO, nextDay(dayFmo0, dayFmo1), '14:15', 'certificates', 'active');
  add(userIdByLogin['g.timofeev'], MEO, nextDay(dayMeo0, dayMeo1), '11:15', 'transfer', 'active');
}

module.exports = { seedAppointments };
