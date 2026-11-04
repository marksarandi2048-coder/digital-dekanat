'use strict';
// Вымышленные объявления деканата для seed. Даты — относительно сегодняшнего дня,
// поэтому «Ближайшие дедлайны» всегда живые.
const { addDays } = require('../src/dates');

function seedAnnouncements({ db, today, userIdByLogin }) {
  const staffId = userIdByLogin.dekanat;
  const insert = db.prepare(`
    INSERT INTO announcements (author_id, title, body, important, faculty, course, group_name, deadline_on, created_at)
    VALUES (@author_id, @title, @body, @important, @faculty, @course, @group_name, @deadline_on, @created_at)`);
  const date = (n) => addDays(today, n);
  const human = (n) =>
    new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(`${date(n)}T00:00:00Z`));

  const FMO = 'Факультет международных отношений';
  const MEO = 'Факультет международных экономических отношений';

  const list = [
    {
      title: 'Запись на курсы по выбору на весенний семестр',
      body:
        `Открыта запись на курсы по выбору на весенний семестр. Студентам 2 курса ФМО нужно выбрать два курса из списка ` +
        `(список — у старост групп и в деканате, корпус 1, кабинет 213). Заявление подаётся в деканат до ${human(3)} включительно. ` +
        'Если не записаться вовремя, курсы будут назначены автоматически по остаточному принципу.',
      important: 1,
      faculty: FMO,
      course: 2,
      deadline_on: date(3),
      created_at: `${date(-2)} 11:00`,
    },
    {
      title: 'Документы на повышенную стипендию',
      body:
        'Студенты, претендующие на повышенную государственную академическую стипендию за достижения в учёбе, науке, ' +
        'общественной, культурно-творческой или спортивной деятельности, подают документы в деканат своего факультета ' +
        `до ${human(6)}. Нужны: заявление, копии дипломов и грамот, подтверждение публикаций или участия в мероприятиях. ` +
        'Достижения учитываются за последний год.',
      important: 0,
      deadline_on: date(6),
      created_at: `${date(-3)} 10:00`,
    },
    {
      title: 'Изменение графика работы деканата МЭО',
      body:
        `С ${human(1)} деканат МЭО работает по новому графику: понедельник–четверг 10:00–17:00, пятница 10:00–15:00, ` +
        `обед 13:00–14:00. ${human(9)} приёма не будет — санитарный день. Готовые справки можно забрать в часы работы ` +
        'деканата (корпус 3, кабинет 405).',
      important: 1,
      faculty: MEO,
      created_at: `${date(-1)} 16:00`,
    },
    {
      title: 'Встреча с выпускниками факультета, работающими в дипломатических представительствах',
      body:
        `Факультет международных отношений приглашает студентов на встречу с выпускниками-дипломатами: ${human(10)}, 18:00, ` +
        `корпус 1, актовый зал. Выпускники расскажут о стажировках и первых годах службы, будет время для вопросов. ` +
        `Количество мест ограничено — регистрация у старост групп до ${human(8)}.`,
      important: 0,
      faculty: FMO,
      deadline_on: date(8),
      created_at: `${date(-4)} 12:00`,
    },
    {
      title: 'Выбор темы курсовой работы',
      body:
        `Группа МЭО-3-07: до ${human(10)} нужно согласовать тему курсовой работы с научным руководителем и сдать ` +
        'подписанный бланк старосте. Список руководителей и примерных тем — на кафедре мировой экономики.',
      important: 0,
      group_name: 'МЭО-3-07',
      deadline_on: date(10),
      created_at: `${date(-1)} 09:30`,
    },
  ];

  for (const a of list) {
    insert.run({ author_id: staffId, faculty: null, course: null, group_name: null, deadline_on: null, important: 0, ...a });
  }

  // Часть уведомлений уже «прочитана», чтобы было видно разницу:
  // старые события по заявкам (раньше чем 3 дня назад) и объявление о стипендии у Аксёновой.
  const markRead = db.prepare('INSERT OR IGNORE INTO notification_reads (user_id, item_key, read_at) VALUES (?, ?, ?)');
  const oldEvents = db
    .prepare(`SELECT e.id, r.student_id FROM request_events e JOIN requests r ON r.id = e.request_id
              WHERE e.actor_id != r.student_id AND e.at < ?`)
    .all(`${date(-3)} 00:00`);
  for (const e of oldEvents) markRead.run(e.student_id, `request_event:${e.id}`, `${date(-3)} 12:00`);
  const stipend = db.prepare("SELECT id FROM announcements WHERE title LIKE 'Документы на повышенную%'").get();
  markRead.run(userIdByLogin['v.aksenova'], `announcement:${stipend.id}`, `${date(-2)} 19:00`);

  return { announcementCount: list.length };
}

module.exports = { seedAnnouncements };
