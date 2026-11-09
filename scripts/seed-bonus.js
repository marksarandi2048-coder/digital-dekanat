'use strict';
// Вымышленные возможности заработать надбавку и записи студентов на разных шагах.
const { addDays } = require('../src/dates');

function seedBonus({ db, today, userIdByLogin }) {
  const date = (n) => addDays(today, n);
  const insertOpportunity = db.prepare(`
    INSERT INTO bonus_opportunities (category, title, description, organizer, points, signup_until, event_on)
    VALUES (@category, @title, @description, @organizer, @points, @signup_until, @event_on)`);
  const insertEnrollment = db.prepare(`
    INSERT INTO bonus_enrollments (opportunity_id, student_id, status, created_at, updated_at, bonus_id)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const bonusId = db.prepare('SELECT id FROM bonuses WHERE student_id = ? AND title = ?');

  const list = [
    ['volunteering', 'Волонтёр на конференции «Диалог культур»', 'Встреча гостей, навигация и помощь на секциях в течение двух дней.', 'Студенческий совет', 2, 11, 18],
    ['volunteering', 'Помощь на Дне открытых дверей', 'Рассказать абитуриентам о факультете и провести их по корпусам.', 'Приёмная комиссия', 1, 4, 13],
    ['sport', 'Секция плавания МГИМО', 'Две тренировки в неделю в течение семестра.', 'Спортивный клуб', 2, 20, null],
    ['sport', 'Секция настольного тенниса МГИМО', 'Тренировка раз в неделю и участие во внутреннем турнире.', 'Спортивный клуб', 1, 14, null],
    ['research', 'Конкурс студенческих статей', 'Статья объёмом до 20 страниц по теме своего направления.', 'Студенческое научное общество', 3, 25, 40],
    ['research', 'Модель ООН', 'Деловая игра: подготовка позиции страны и работа в комитете.', 'Клуб международников', 3, 7, 30],
    ['research', 'Круглый стол по мировой экономике', 'Короткий доклад и участие в обсуждении.', 'Студенческое научное общество', 2, -3, 2],
    ['volunteering', 'Волонтёр международной студенческой конференции', 'Помощь в организации конференции.', 'Студенческий совет', 2, -40, -25],
    ['sport', 'Сборная МГИМО по баскетболу', 'Тренировки и игры за сборную.', 'Спортивный клуб', 2, -45, -30],
  ];
  const id = {};
  for (const [category, title, description, organizer, points, signup, event] of list) {
    id[title] = insertOpportunity.run({
      category, title, description, organizer, points, signup_until: date(signup), event_on: event === null ? null : date(event),
    }).lastInsertRowid;
  }

  const stamp = (n, time) => `${date(n)} ${time}`;
  const add = (login, title, status, created, updated, withBonus) => {
    const student = userIdByLogin[login];
    const bonus = withBonus ? bonusId.get(student, title).id : null;
    insertEnrollment.run(id[title], student, status, created, updated, bonus);
  };
  // Уже начисленные записи ссылаются на надбавку из заполнения оценок, поэтому рейтинг не меняется.
  add('v.aksenova', 'Волонтёр международной студенческой конференции', 'awarded', stamp(-40, '12:00'), stamp(-25, '16:00'), true);
  add('v.aksenova', 'Волонтёр на конференции «Диалог культур»', 'confirmed', stamp(-4, '10:15'), stamp(-1, '11:40'));
  add('v.aksenova', 'Секция настольного тенниса МГИМО', 'submitted', stamp(-1, '18:30'), stamp(-1, '18:30'));
  add('g.timofeev', 'Сборная МГИМО по баскетболу', 'awarded', stamp(-45, '09:30'), stamp(-30, '15:00'), true);
  add('g.timofeev', 'Модель ООН', 'submitted', stamp(-2, '20:10'), stamp(-2, '20:10'));
  add('g.timofeev', 'Круглый стол по мировой экономике', 'rejected', stamp(-6, '13:00'), stamp(-2, '12:20'));

  return { opportunityCount: list.length };
}

module.exports = { seedBonus };
