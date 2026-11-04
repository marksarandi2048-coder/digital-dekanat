'use strict';
// Заполнение базы вымышленными данными: npm run seed
// Все люди, группы и логины выдуманы. Скрипт можно запускать повторно —
// тестовые пользователи создаются заново.
const bcrypt = require('bcrypt');
const { db, DB_PATH } = require('../src/db');

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

const insert = db.prepare(`
  INSERT INTO users (login, password_hash, role, full_name, faculty, program, course, group_name, position)
  VALUES (@login, @password_hash, @role, @full_name, @faculty, @program, @course, @group_name, @position)
`);

const rows = users.map((u) => ({
  program: null,
  course: null,
  group_name: null,
  position: null,
  ...u,
  password_hash: bcrypt.hashSync(u.password, 12),
}));

db.transaction(() => {
  db.prepare('DELETE FROM users').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'users'").run();
  for (const { password, ...row } of rows) insert.run(row);
})();

console.log(`База заполнена: ${DB_PATH}`);
for (const u of users) {
  console.log(`  ${u.role === 'staff' ? 'сотрудник' : 'студент  '}  ${u.login} / ${u.password}  — ${u.full_name}`);
}
