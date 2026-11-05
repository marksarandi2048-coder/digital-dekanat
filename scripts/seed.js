'use strict';
// Заполнение базы вымышленными данными: npm run seed
// Все люди, группы, логины и преподаватели выдуманы. Скрипт можно запускать
// повторно — данные создаются заново. Расписание строится от текущей недели,
// поэтому изменения всегда видны «на этой неделе».
const bcrypt = require('bcrypt');
const { db, DB_PATH, createSchema } = require('../src/db');
const { nowInMoscow, addDays, mondayOf } = require('../src/dates');
const { seedGrades } = require('./seed-grades');
const { seedRequests } = require('./seed-requests');
const { seedAnnouncements } = require('./seed-announcements');
const { assignDisciplineColors } = require('../src/colors');

// ---------- Пользователи ----------
const users = [
  {
    login: 'v.aksenova',
    password: 'Student-1-demo',
    role: 'student',
    full_name: 'Аксёнова Вероника Игоревна',
    faculty: 'Факультет международных отношений',
    program: 'Международные отношения',
    course: 2,
    group_name: 'МО-2-03',
  },
  {
    login: 'g.timofeev',
    password: 'Student-2-demo',
    role: 'student',
    full_name: 'Тимофеев Глеб Андреевич',
    faculty: 'Факультет международных экономических отношений',
    program: 'Экономика',
    course: 3,
    group_name: 'МЭО-3-07',
  },
  {
    login: 'dekanat',
    password: 'Staff-demo-2026',
    role: 'staff',
    full_name: 'Лаврентьева Ольга Петровна',
    faculty: 'Факультет международных отношений',
    position: 'Специалист по учебно-методической работе',
  },
];

// ---------- Группы ----------
const groups = {
  'МО-2-03': 'Факультет международных отношений',
  'МЭО-3-07': 'Факультет международных экономических отношений',
};

// Кураторы групп (вымышленные; почта — на домене для примеров example.edu).
const curators = {
  'МО-2-03': ['Воронцова Ирина Павловна', 'i.vorontsova@example.edu'],
  'МЭО-3-07': ['Сергеев Андрей Николаевич', 'a.sergeev@example.edu'],
};

// Короткие названия дисциплин для карточек «Недели». Сокращения, привычные студентам.
const shortNames = {
  'Английский язык': 'Английский',
  'Бухгалтерский учёт': 'Бухучёт',
  'Введение в дипломатическую практику': 'Дипл. практика',
  'Введение в теорию международных отношений': 'Введение в ТМО',
  'История международных отношений': 'История МО',
  'История экономических учений': 'История эк. учений',
  'Линейная алгебра': 'Лин. алгебра',
  'Международное право': 'Межд. право',
  'Международные валютно-кредитные отношения': 'МВКО',
  'Теория международных отношений': 'ТМО',
  'Физическая культура': 'Физкультура',
  'Французский язык': 'Французский',
  'Экономическая теория': 'Экон. теория',
};

// ---------- Преподаватели (вымышленные) ----------
const teachers = {
  belyaev: ['Беляев Игорь Сергеевич', 'доцент'],
  koroleva: ['Королёва Анна Викторовна', 'профессор'],
  dubrovin: ['Дубровин Павел Олегович', 'старший преподаватель'],
  shestakova: ['Шестакова Мария Юрьевна', 'старший преподаватель'],
  rudnev: ['Руднев Константин Ильич', 'доцент'],
  zimina: ['Зимина Елена Аркадьевна', 'доцент'],
  orlov: ['Орлов Денис Валерьевич', 'преподаватель'],
  gromova: ['Громова Ирина Львовна', 'профессор'],
  savchenko: ['Савченко Артём Николаевич', 'доцент'],
  lebedeva: ['Лебедева Ксения Романовна', 'старший преподаватель'],
  fomin: ['Фомин Сергей Дмитриевич', 'доцент'],
  egorova: ['Егорова Татьяна Борисовна', 'доцент'],
};

// ---------- Недельная сетка по группам ----------
// day: 0 — понедельник … 5 — суббота; pair — номер пары.
const L = (day, pair, discipline, kind, teacher, building, room) => ({ day, pair, discipline, kind, teacher, building, room });

const templates = {
  'МО-2-03': [
    L(0, 1, 'Теория международных отношений', 'lecture', 'koroleva', 'Корпус 1', '201'),
    L(0, 2, 'Теория международных отношений', 'seminar', 'belyaev', 'Корпус 1', '312'),
    L(0, 3, 'Английский язык', 'practice', 'shestakova', 'Корпус 2', '418'),
    L(1, 1, 'История международных отношений', 'lecture', 'rudnev', 'Корпус 1', '201'),
    L(1, 2, 'Французский язык', 'practice', 'zimina', 'Корпус 2', '407'),
    L(1, 3, 'Экономическая теория', 'seminar', 'savchenko', 'Корпус 1', '305'),
    L(2, 1, 'Международное право', 'lecture', 'gromova', 'Корпус 1', '101'),
    L(2, 2, 'Английский язык', 'practice', 'shestakova', 'Корпус 2', '418'),
    L(2, 3, 'История международных отношений', 'seminar', 'rudnev', 'Корпус 1', '310'),
    L(3, 2, 'Экономическая теория', 'lecture', 'savchenko', 'Корпус 1', '101'),
    L(3, 3, 'Международное право', 'seminar', 'dubrovin', 'Корпус 1', '214'),
    L(3, 4, 'Физическая культура', 'practice', 'orlov', 'Спорткомплекс', 'Зал 2'),
    L(4, 1, 'Французский язык', 'practice', 'zimina', 'Корпус 2', '407'),
    L(4, 2, 'Английский язык', 'practice', 'shestakova', 'Корпус 2', '418'),
    L(5, 2, 'Введение в дипломатическую практику', 'seminar', 'dubrovin', 'Корпус 1', '214'),
  ],
  'МЭО-3-07': [
    L(0, 2, 'Макроэкономика', 'lecture', 'fomin', 'Корпус 1', '102'),
    L(0, 3, 'Макроэкономика', 'seminar', 'lebedeva', 'Корпус 3', '509'),
    L(0, 4, 'Английский язык', 'practice', 'egorova', 'Корпус 2', '421'),
    L(1, 1, 'Эконометрика', 'lecture', 'savchenko', 'Корпус 1', '102'),
    L(1, 2, 'Эконометрика', 'practice', 'lebedeva', 'Корпус 3', 'Компьютерный класс 3'),
    L(1, 3, 'Мировая экономика', 'seminar', 'koroleva', 'Корпус 3', '512'),
    L(2, 2, 'Финансовые рынки', 'lecture', 'fomin', 'Корпус 1', '102'),
    L(2, 3, 'Английский язык', 'practice', 'egorova', 'Корпус 2', '421'),
    L(2, 4, 'Мировая экономика', 'lecture', 'koroleva', 'Корпус 1', '101'),
    L(3, 1, 'Международные валютно-кредитные отношения', 'lecture', 'gromova', 'Корпус 1', '102'),
    L(3, 2, 'Финансовые рынки', 'seminar', 'fomin', 'Корпус 3', '506'),
    L(3, 3, 'Физическая культура', 'practice', 'orlov', 'Спорткомплекс', 'Зал 1'),
    L(4, 2, 'Международные валютно-кредитные отношения', 'seminar', 'savchenko', 'Корпус 3', '509'),
    L(4, 3, 'Английский язык', 'practice', 'egorova', 'Корпус 2', '421'),
  ],
};

// ---------- Изменения на текущей неделе ----------
// Для каждой группы — по одному примеру каждого вида изменения.
const changes = {
  'МО-2-03': [
    { day: 0, pair: 2, type: 'room_changed', building: 'Корпус 1', room: '408', note: 'В аудитории 312 ремонт проектора' },
    { day: 1, pair: 2, type: 'teacher_changed', teacher: 'lebedeva', note: 'Преподаватель на конференции' },
    { day: 2, pair: 3, type: 'cancelled', note: 'Преподаватель заболел. Задание — в электронном курсе' },
    { day: 3, pair: 3, type: 'moved', toDay: 4, toPair: 3, note: 'Перенос по просьбе преподавателя' },
  ],
  'МЭО-3-07': [
    { day: 0, pair: 4, type: 'room_changed', building: 'Корпус 2', room: '415', note: 'Аудитория занята на конференции' },
    { day: 1, pair: 3, type: 'teacher_changed', teacher: 'egorova', note: 'Замена на время командировки' },
    { day: 2, pair: 4, type: 'cancelled', note: 'Лекция будет восполнена позже' },
    { day: 3, pair: 2, type: 'moved', toDay: 4, toPair: 4, note: 'Совпадение с мероприятием факультета' },
  ],
};

// Период расписания: с понедельника за 2 недели до текущей и до 31 декабря
// текущего года. Изменения — на текущей неделе (той, в которую запущен seed).
const WEEKS_BEFORE = 2;

// ---------- Запись в базу ----------
const insertUser = db.prepare(`
  INSERT INTO users (login, password_hash, role, full_name, faculty, program, course, group_name, position)
  VALUES (@login, @password_hash, @role, @full_name, @faculty, @program, @course, @group_name, @position)
`);
// Таблица занятий пересоздаётся: так в уже существующей базе обновляются
// ограничения (например, допустимые номера пар). Данные в ней — только тестовые.
db.exec('DROP TABLE IF EXISTS lessons');
createSchema();

const insertGroup = db.prepare('INSERT INTO groups (name, faculty, curator_name, curator_email) VALUES (?, ?, ?, ?)');
const insertTeacher = db.prepare('INSERT INTO teachers (full_name, title) VALUES (?, ?)');
const insertDiscipline = db.prepare('INSERT INTO disciplines (name) VALUES (?)');
const insertLesson = db.prepare(`
  INSERT INTO lessons (group_name, discipline_id, teacher_id, kind, date, pair, building, room,
                       status, old_date, old_pair, old_building, old_room, old_teacher_id, change_note, changed_at)
  VALUES (@group_name, @discipline_id, @teacher_id, @kind, @date, @pair, @building, @room,
          @status, @old_date, @old_pair, @old_building, @old_room, @old_teacher_id, @change_note, @changed_at)
`);

const userRows = users.map((u) => ({
  program: null,
  course: null,
  group_name: null,
  position: null,
  ...u,
  password_hash: bcrypt.hashSync(u.password, 12),
}));

const today = nowInMoscow().date;
const currentMonday = mondayOf(today);
const firstMonday = addDays(currentMonday, -WEEKS_BEFORE * 7);
const lastDate = `${today.slice(0, 4)}-12-31`;
// Изменения «объявлены» в субботу перед текущей неделей.
const changedAt = `${addDays(currentMonday, -2)} 15:30`;

let lessonCount = 0;
let resultCount = 0;
let requestCount = 0;
let announcementCount = 0;
let colorInfo = { colored: 0, conflicts: 0 };

db.transaction(() => {
  const tables = ['notification_reads', 'announcements', 'e_certificates', 'request_messages', 'request_events', 'requests', 'bonuses', 'social_scores', 'results', 'assessments', 'semesters', 'lessons', 'teachers', 'disciplines', 'groups', 'users'];
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
  }

  const userIdByLogin = {};
  for (const { password, ...row } of userRows) userIdByLogin[row.login] = insertUser.run(row).lastInsertRowid;
  for (const [name, faculty] of Object.entries(groups)) insertGroup.run(name, faculty, ...(curators[name] || [null, null]));

  const teacherId = {};
  for (const [key, [name, title]] of Object.entries(teachers)) {
    teacherId[key] = insertTeacher.run(name, title).lastInsertRowid;
  }

  const disciplineId = {};
  const disciplineIdFor = (name) => {
    if (!disciplineId[name]) disciplineId[name] = insertDiscipline.run(name).lastInsertRowid;
    return disciplineId[name];
  };
  for (const items of Object.values(templates)) {
    for (const { discipline } of items) disciplineIdFor(discipline);
  }

  for (const [group, items] of Object.entries(templates)) {
    for (let monday = firstMonday; monday <= lastDate; monday = addDays(monday, 7)) {
      const isCurrentWeek = monday === currentMonday;
      for (const t of items) {
        if (addDays(monday, t.day) > lastDate) continue; // после 31 декабря занятий нет
        const lesson = {
          group_name: group,
          discipline_id: disciplineId[t.discipline],
          teacher_id: teacherId[t.teacher],
          kind: t.kind,
          date: addDays(monday, t.day),
          pair: t.pair,
          building: t.building,
          room: t.room,
          status: 'normal',
          old_date: null,
          old_pair: null,
          old_building: null,
          old_room: null,
          old_teacher_id: null,
          change_note: null,
          changed_at: null,
        };

        const change = isCurrentWeek && changes[group].find((c) => c.day === t.day && c.pair === t.pair);
        if (change) {
          lesson.status = change.type;
          lesson.change_note = change.note;
          lesson.changed_at = changedAt;
          if (change.type === 'room_changed') {
            lesson.old_building = t.building;
            lesson.old_room = t.room;
            lesson.building = change.building;
            lesson.room = change.room;
          } else if (change.type === 'teacher_changed') {
            lesson.old_teacher_id = lesson.teacher_id;
            lesson.teacher_id = teacherId[change.teacher];
          } else if (change.type === 'moved') {
            lesson.old_date = lesson.date;
            lesson.old_pair = lesson.pair;
            lesson.date = addDays(monday, change.toDay);
            lesson.pair = change.toPair;
          }
        }

        insertLesson.run(lesson);
        lessonCount += 1;
      }
    }
  }

  ({ resultCount } = seedGrades({ db, today, teacherId, disciplineIdFor, userIdByLogin }));
  ({ requestCount } = seedRequests({ db, today, userIdByLogin }));
  ({ announcementCount } = seedAnnouncements({ db, today, userIdByLogin }));
  colorInfo = assignDisciplineColors(db);
  const setShort = db.prepare('UPDATE disciplines SET short_name = ? WHERE name = ?');
  for (const [name, short] of Object.entries(shortNames)) setShort.run(short, name);
})();

// Проверка: в одной группе не должно быть двух занятий в одну пару.
const clash = db
  .prepare(`SELECT group_name, date, pair FROM lessons WHERE status != 'cancelled'
            GROUP BY group_name, date, pair HAVING COUNT(*) > 1`)
  .all();
if (clash.length) {
  console.error('Ошибка в данных: накладки в расписании', clash);
  process.exit(1);
}

console.log(`База заполнена: ${DB_PATH}`);
console.log(`Заявок: ${requestCount}, объявлений: ${announcementCount}`);
console.log(`Цвета дисциплин: ${colorInfo.colored} дисциплин, повторов внутри группы: ${colorInfo.conflicts}`);
console.log(`Оценок по дисциплинам: ${resultCount} (2 семестра)`);
console.log(`Занятий: ${lessonCount} (с ${firstMonday} по ${lastDate}, изменения на неделе с ${currentMonday})`);
for (const u of users) {
  console.log(`  ${u.role === 'staff' ? 'сотрудник' : 'студент  '}  ${u.login} / ${u.password}  — ${u.full_name}`);
}
