'use strict';
// Чтение расписания из базы.
const { db } = require('./db');
const { PAIRS } = require('./pairs');

// Занятия группы за период, а также занятия, которые были в этом периоде,
// но их перенесли (чтобы на старом месте показать «перенесено на …»).
const rangeQuery = db.prepare(`
  SELECT l.*, d.name AS discipline,
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

const groupsQuery = db.prepare('SELECT DISTINCT group_name FROM lessons ORDER BY group_name');

function toLesson(row) {
  const lesson = {
    id: row.id,
    date: row.date,
    pair: row.pair,
    time: PAIRS[row.pair],
    discipline: row.discipline,
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
      oldTime: row.old_pair ? PAIRS[row.old_pair] : null,
      oldBuilding: row.old_building,
      oldRoom: row.old_room,
      oldTeacher: row.old_teacher,
      note: row.change_note,
      changedAt: row.changed_at,
    };
  }
  return lesson;
}

function getSchedule(group, from, to) {
  const rows = rangeQuery.all({ group, from, to });
  const lessons = [];
  const movedAway = [];
  for (const row of rows) {
    const lesson = toLesson(row);
    if (row.date >= from && row.date <= to) lessons.push(lesson);
    if (row.status === 'moved' && row.old_date >= from && row.old_date <= to) movedAway.push(lesson);
  }
  return { lessons, movedAway };
}

function listGroups() {
  return groupsQuery.all().map((r) => r.group_name);
}

module.exports = { getSchedule, listGroups, PAIRS };
