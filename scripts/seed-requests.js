'use strict';
// Вымышленные заявки для seed. Все даты — относительно сегодняшнего дня,
// поэтому «трекер» всегда выглядит живым.
const { addDays } = require('../src/dates');

function seedRequests({ db, today, userIdByLogin }) {
  // Подключаем здесь, после того как seed пересоздал таблицы.
  const R = require('../src/requests');

  const insertRequest = db.prepare(`
    INSERT INTO requests (student_id, type, format, purpose, order_ref, copies, subject, comment, status, created_at, updated_at)
    VALUES (@student_id, @type, @format, @purpose, @order_ref, @copies, @subject, @comment, 'accepted', @at, @at)`);
  const insertEvent = db.prepare('INSERT INTO request_events (request_id, status, at, actor_id, note) VALUES (?, ?, ?, ?, ?)');

  const at = (daysAgo, time) => `${addDays(today, -daysAgo)} ${time}`;
  const staff = db.prepare('SELECT * FROM users WHERE login = ?').get('dekanat');

  // steps: [статус, когда, { note, reason }]
  function make(login, data, created, steps = []) {
    const studentId = userIdByLogin[login];
    const row = { student_id: studentId, format: null, purpose: null, order_ref: null, copies: null, subject: null, comment: null, ...data, at: created };
    const id = insertRequest.run(row).lastInsertRowid;
    insertEvent.run(id, 'accepted', created, studentId, null);
    for (const [status, when, extra = {}] of steps) {
      const r = R.getRequest(id);
      const pickup = status === 'ready' && r.format === 'paper' ? require('../src/requestTypes').pickupFor(r.student_faculty) : {};
      R.changeStatus(r, staff, { status, note: extra.note, rejectReason: extra.reason, pickupPlace: pickup.place, pickupHours: pickup.hours }, when);
    }
    return id;
  }

  // ---------- Аксёнова ----------
  make('v.aksenova', { type: 'study_certificate', format: 'paper', purpose: 'По месту требования', copies: 1 }, at(21, '10:05'), [
    ['in_progress', at(21, '14:20')],
    ['ready', at(20, '11:00')],
    ['issued', at(19, '12:30')],
  ]);
  // Электронная справка с истёкшим сроком — чтобы показать «недействительна» на проверке.
  make('v.aksenova', { type: 'study_certificate', format: 'electronic', purpose: 'В визовый центр' }, at(41, '09:40'), [
    ['in_progress', at(41, '11:15')],
    ['ready', at(40, '16:05')],
  ]);
  // Действующая электронная справка с QR.
  make('v.aksenova', { type: 'study_certificate', format: 'electronic', purpose: 'В визовый центр (посольство Франции)' }, at(3, '10:12'), [
    ['in_progress', at(2, '11:05')],
    ['ready', at(1, '15:40')],
  ]);
  make(
    'v.aksenova',
    { type: 'order_extract', format: 'paper', order_ref: 'О назначении стипендии', purpose: 'В банк', copies: 1, comment: 'Нужна с печатью деканата' },
    at(1, '18:20'),
    [['in_progress', at(0, '09:30'), { note: 'Приказ запросили в архиве. Выписка будет готова в течение двух рабочих дней.' }]],
  );

  // ---------- Тимофеев ----------
  make('g.timofeev', { type: 'enrollment_certificate', format: 'paper', purpose: 'По месту работы родителей', copies: 2 }, at(4, '09:15'), [
    ['in_progress', at(3, '10:00')],
    ['ready', at(1, '16:10')],
  ]);
  make(
    'g.timofeev',
    {
      type: 'appeal',
      subject: 'Не выставлены баллы по дисциплине «Международные валютно-кредитные отношения»',
      comment: 'Срок был 31 октября, а в кабинете баллов до сих пор нет. Подскажите, пожалуйста, когда их выставят?',
    },
    at(2, '20:41'),
    [
      ['in_progress', at(1, '10:00')],
      ['answered', at(1, '12:15'), { note: 'Здравствуйте! Преподаватель передал ведомость, баллы появятся в кабинете до конца недели. Если не появятся — напишите сюда.' }],
    ],
  );
  make('g.timofeev', { type: 'order_extract', format: 'paper', order_ref: 'Не знаю, какой нужен', purpose: 'Для работы', copies: 1 }, at(6, '13:30'), [
    ['rejected', at(5, '10:20'), { reason: 'Не указано, из какого приказа нужна выписка. Подайте, пожалуйста, новую заявку и выберите приказ из списка.' }],
  ]);
  make('g.timofeev', { type: 'study_certificate', format: 'paper', purpose: 'В военкомат', copies: 1 }, at(0, '08:55'));

  return { requestCount: db.prepare('SELECT COUNT(*) AS n FROM requests').get().n };
}

module.exports = { seedRequests };
