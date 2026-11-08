'use strict';
// Чтение успеваемости студента из базы и сборка сводки «как у меня дела».
const { db } = require('./db');
const { calculate, statusOf } = require('./rating');
const { colorOf } = require('./colors');

const semestersQuery = db.prepare('SELECT * FROM semesters ORDER BY starts_on DESC');

// Дисциплины группы студента в семестре + его оценки (если есть).
const disciplinesQuery = db.prepare(`
  SELECT a.id, a.control, a.current_max, a.current_due, a.result_due, a.exam_date,
         d.name AS discipline, d.color AS discipline_color, a.discipline_id, t.full_name AS teacher,
         r.current_points, r.current_set_at, r.grade, r.grade_set_at
  FROM assessments a
  JOIN disciplines d ON d.id = a.discipline_id
  JOIN teachers t ON t.id = a.teacher_id
  LEFT JOIN results r ON r.assessment_id = a.id AND r.student_id = @studentId
  WHERE a.semester_id = @semesterId AND a.group_name = @group
  ORDER BY a.control DESC, d.name
`);

const socialQuery = db.prepare('SELECT * FROM social_scores WHERE student_id = ? AND semester_id = ?');
const bonusesQuery = db.prepare(
  'SELECT category, title, points, awarded_on FROM bonuses WHERE student_id = ? AND semester_id = ? ORDER BY awarded_on',
);

function listSemesters(today) {
  const all = semestersQuery.all();
  // Текущий — тот, в который попадает сегодняшняя дата; иначе самый поздний начавшийся.
  const current = all.find((s) => s.starts_on <= today && today <= s.ends_on) || all.find((s) => s.starts_on <= today) || all[0];
  return all.map((s) => ({ id: s.id, name: s.name, startsOn: s.starts_on, endsOn: s.ends_on, isCurrent: current && s.id === current.id }));
}

function semesterData(student, semesterId, today) {
  const rows = disciplinesQuery.all({ studentId: student.id, semesterId, group: student.group_name });

  const disciplines = rows.map((r) => ({
    id: r.id,
    discipline: r.discipline,
    color: colorOf(r),
    teacher: r.teacher,
    control: r.control,
    examDate: r.exam_date,
    currentMax: r.current_max,
    currentPoints: r.current_points,
    currentStatus: statusOf(r.current_points, r.current_set_at, r.current_due, today),
    grade: r.grade,
    gradeStatus: statusOf(r.grade, r.grade_set_at, r.result_due, today),
  }));

  const s = socialQuery.get(student.id, semesterId);
  const social = s
    ? { points: s.points, maxPoints: s.max_points, note: s.note, status: statusOf(s.points, s.set_at, s.due, today) }
    : null;

  const bonuses = bonusesQuery.all(student.id, semesterId).map((b) => ({
    category: b.category,
    title: b.title,
    points: b.points,
    awardedOn: b.awarded_on,
  }));

  const rating = calculate({ disciplines, social, bonuses });

  // Все «ожидаемые» оценки (баллы, экзамен/зачёт, общественная активность).
  const items = [];
  for (const d of disciplines) {
    items.push({ what: 'Баллы за семестр', discipline: d.discipline, status: d.currentStatus });
    items.push({ what: d.control === 'exam' ? 'Экзамен' : 'Зачёт', discipline: d.discipline, status: d.gradeStatus });
  }
  if (social) items.push({ what: 'Общественная активность', discipline: null, status: social.status });

  const pending = items.filter((i) => i.status.state === 'pending');
  // Ближайший срок и всё, что к нему ожидается.
  const nearestDue = pending.map((i) => i.status.due).sort()[0];
  const nextDeadline = nearestDue
    ? { due: nearestDue, items: pending.filter((i) => i.status.due === nearestDue).map(({ what, discipline }) => ({ what, discipline })) }
    : null;

  const summary = {
    gradesTotal: disciplines.length,
    gradesSet: disciplines.filter((d) => d.grade).length,
    pending: pending.length,
    overdue: items.filter((i) => i.status.state === 'overdue').length,
    debts: disciplines.filter((d) => d.grade === '2' || d.grade === 'failed').map((d) => d.discipline),
    // Семестр без единой дисциплины не считается закрытым.
    isFinal: items.length > 0 && items.every((i) => i.status.state === 'set'),
    nextDeadline,
  };

  return { disciplines, social, bonuses, rating, summary };
}

module.exports = { listSemesters, semesterData };
