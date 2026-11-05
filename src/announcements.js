'use strict';
// Объявления деканата: как показать и сколько адресатов их прочитали.
// Проверка ПРАВ — в маршрутах; здесь только работа с данными.
const { db } = require('./db');
const { audienceMatches } = require('./notifications');

const q = {
  author: db.prepare('SELECT full_name FROM users WHERE id = ?'),
  all: db.prepare('SELECT * FROM announcements ORDER BY removed_at IS NOT NULL, created_at DESC'),
  students: db.prepare("SELECT id, faculty, course, group_name FROM users WHERE role = 'student'"),
  readsOf: db.prepare('SELECT user_id FROM notification_reads WHERE item_key = ?'),
};

function audienceLabel(a) {
  if (a.group_name) return `Группа ${a.group_name}`;
  if (a.faculty && a.course) return `${a.course} курс, ${a.faculty}`;
  if (a.faculty) return a.faculty;
  if (a.course) return `${a.course} курс, все факультеты`;
  return 'Все студенты';
}

function toAnnouncement(a) {
  const author = q.author.get(a.author_id);
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    important: Boolean(a.important),
    audience: audienceLabel(a),
    deadlineOn: a.deadline_on,
    createdAt: a.created_at,
    removed: Boolean(a.removed_at),
    author: author ? author.full_name : '',
  };
}

// Все объявления (сначала действующие, от новых к старым) со счётчиком «прочитали X из Y».
function listWithStats() {
  const students = q.students.all();
  return q.all.all().map((a) => {
    const recipients = students.filter((s) => audienceMatches({ ...a, removed_at: null }, s));
    const readers = new Set(q.readsOf.all(`announcement:${a.id}`).map((r) => r.user_id));
    return { ...toAnnouncement(a), recipients: recipients.length, read: recipients.filter((s) => readers.has(s.id)).length };
  });
}

module.exports = { toAnnouncement, listWithStats };
