'use strict';
// Чтение расписания из базы.
const { db } = require('./db');
const { pairsFor } = require('./pairs');
const { colorOf } = require('./colors');

// Занятия группы за период, а также занятия, которые были в этом периоде,
// но их перенесли (чтобы на старом месте показать «перенесено на …»).
const rangeQuery = db.prepare(`
  SELECT l.*, d.name AS discipline, d.color AS discipline_color,
         t.full_name AS teacher, t.title AS teacher_title,
         ot.full_name AS old_teacher
  FROM lessons l
  JOIN disciplines d ON d.id = l.discipline_id
  JOIN teachers t ON t.id = l.teacher_id
  LEFT JOIN teachers ot ON ot.id = l.old_teacher_id
  WHERE l.group_name = @group
    AND ((l.date BETWEEN @from AND @to)
      OR (l.status = 'moved' AND l.old_date BETWEEN @from AND @to))
  ORDER BY l.date, l.pair
`);

const groupsQuery = db.prepare('SELECT name FROM groups ORDER BY name');
const facultyQuery = db.prepare('SELECT faculty FROM groups WHERE name = ?');

function toLesson(row, pairs) {
  const lesson = {
    id: row.id,
    date: row.date,
    pair: row.pair,
    time: pairs[row.pair],
    discipline: row.discipline,
    color: colorOf(row),
    kind: row.kind,
    teacher: row.teacher,
    teacherTitle: row.teacher_title,
    building: row.building,
    room: row.room,
    status: row.status,
  };
  if (row.status !== 'normal') {
    lesson.change = {
      oldDate: row.old_date,
      oldPair: row.old_pair,
      oldTime: row.old_pair ? pairs[row.old_pair] : null,
      oldBuilding: row.old_building,
      oldRoom: row.old_room,
      oldTeacher: row.old_teacher,
      note: row.change_note,
      changedAt: row.changed_at,
    };
  }
  return lesson;
}

// Расписание звонков зависит от факультета группы.
function pairsForGroup(group) {
  const row = facultyQuery.get(group);
  return pairsFor(row ? row.faculty : null);
}

function getSchedule(group, from, to) {
  const pairs = pairsForGroup(group);
  const rows = rangeQuery.all({ group, from, to });
  const lessons = [];
  const movedAway = [];
  for (const row of rows) {
    const lesson = toLesson(row, pairs);
    if (row.date >= from && row.date <= to) lessons.push(lesson);
    if (row.status === 'moved' && row.old_date >= from && row.old_date <= to) movedAway.push(lesson);
  }
  return { pairs, lessons, movedAway };
}

function listGroups() {
  return groupsQuery.all().map((r) => r.name);
}

module.exports = { getSchedule, listGroups };
