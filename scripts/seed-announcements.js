'use strict';
// Вымышленные объявления деканата для seed. Даты — относительно сегодняшнего дня,
// поэтому «Ближайшие дедлайны» всегда живые.
const { addDays } = require('../src/dates');

function seedAnnouncements({ db, today, userIdByLogin }) {
  const staffId = userIdByLogin.dekanat;
  const insert = db.prepare(`
    INSERT INTO announcements (author_id, title, body, title_en, body_en, important, faculty, course, group_name, deadline_on, created_at)
    VALUES (@author_id, @title, @body, @title_en, @body_en, @important, @faculty, @course, @group_name, @deadline_on, @created_at)`);
  const date = (n) => addDays(today, n);
  const human = (n) =>
    new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(`${date(n)}T00:00:00Z`));

  const humanEn = (n) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(`${date(n)}T00:00:00Z`));

  const FMO = 'Факультет международных отношений';
  const MEO = 'Факультет международных экономических отношений';

  const list = [
    {
      title: 'Запись на курсы по выбору на весенний семестр',
      title_en: 'Elective course registration for the spring semester',
      body_en:
        `Registration for spring semester electives is open. Year 2 FIR students must choose two courses from the list (available from group representatives and at the Dean’s Office, Building 1, Room 213). Submit your application to the Dean’s Office by ${humanEn(3)} inclusive. If you do not register on time, courses will be assigned automatically from those still available.`,
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
      title_en: 'Documents for the enhanced scholarship',
      body_en:
        `Students applying for the enhanced state academic scholarship for achievements in studies, research, community, creative or sports activities should submit documents to their faculty’s Dean’s Office by ${humanEn(6)}. You will need an application, copies of diplomas and certificates, and proof of publications or participation in events. Achievements from the past year are taken into account.`,
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
      title_en: 'Change to the FIER Dean’s Office hours',
      body_en:
        `From ${humanEn(1)}, the FIER Dean’s Office has new hours: Monday–Thursday 10:00–17:00, Friday 10:00–15:00, lunch 13:00–14:00. There will be no appointments on ${humanEn(9)} — the office is closed for cleaning. Completed certificates can be picked up during office hours (Building 3, Room 405).`,
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
      title_en: 'Meeting with faculty alumni working in diplomatic missions',
      body_en:
        `The Faculty of International Relations invites students to meet alumni diplomats: ${humanEn(10)}, 18:00, Building 1, Assembly Hall. The alumni will talk about internships and their first years of service, and there will be time for questions. Places are limited — register with your group representative by ${humanEn(8)}.`,
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
      title_en: 'Choosing a term paper topic',
      body_en:
        `Group MEO-3-07: by ${humanEn(10)}, agree on your term paper topic with your academic supervisor and hand the signed form to your group representative. The list of supervisors and sample topics is available at the World Economy Department.`,
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
