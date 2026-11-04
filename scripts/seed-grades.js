'use strict';
// Вымышленная успеваемость для seed: весенний семестр (всё выставлено)
// и текущий осенний (часть выставлена, часть ожидается, одна оценка просрочена).
// Даты считаются от текущего учебного года, поэтому данные не устаревают.

function seedGrades({ db, today, teacherId, disciplineIdFor, userIdByLogin }) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const Y = month >= 8 ? year : year - 1; // год начала учебного года
  const N = Y + 1;
  const yy = (n) => String(n % 100).padStart(2, '0');

  const insertSemester = db.prepare('INSERT INTO semesters (name, starts_on, ends_on) VALUES (?, ?, ?)');
  const insertAssessment = db.prepare(`
    INSERT INTO assessments (semester_id, group_name, discipline_id, teacher_id, control, current_max, current_due, result_due, exam_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertResult = db.prepare(`
    INSERT INTO results (student_id, assessment_id, current_points, current_set_at, grade, grade_set_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const insertSocial = db.prepare(`
    INSERT INTO social_scores (student_id, semester_id, points, max_points, note, set_at, due)
    VALUES (?, ?, ?, 10, ?, ?, ?)`);
  const insertBonus = db.prepare(`
    INSERT INTO bonuses (student_id, semester_id, category, title, points, awarded_on)
    VALUES (?, ?, ?, ?, ?, ?)`);

  const spring = insertSemester.run(`Весенний семестр ${Y - 1}/${yy(Y)}`, `${Y}-02-09`, `${Y}-06-30`).lastInsertRowid;
  const autumn = insertSemester.run(`Осенний семестр ${Y}/${yy(N)}`, `${Y}-09-01`, `${N}-01-31`).lastInsertRowid;

  // Сроки (как договорились): баллы за семестр — до 19 декабря, зачёты — до 27 декабря,
  // экзамены — до 30 января. Для показа «срок прошёл» у одной дисциплины срок баллов — 31 октября.
  const DUE = {
    [autumn]: { current: `${Y}-12-19`, credit: `${Y}-12-27`, exam: `${N}-01-30` },
    [spring]: { current: `${Y}-05-30`, credit: `${Y}-06-10`, exam: `${Y}-06-30` },
  };
  const OVERDUE_CURRENT = `${Y}-10-31`;

  // [дисциплина, преподаватель, форма, дата экз./зачёта, баллы, когда, оценка, когда, особый срок баллов]
  const plan = {
    'v.aksenova': {
      group: 'МО-2-03',
      [autumn]: [
        ['Теория международных отношений', 'koroleva', 'exam', `${N}-01-14`, 34, `${Y}-10-30`],
        ['История международных отношений', 'rudnev', 'exam', `${N}-01-19`, null, null, null, null, OVERDUE_CURRENT],
        ['Международное право', 'gromova', 'exam', `${N}-01-24`, 31, `${Y}-11-02`],
        ['Экономическая теория', 'savchenko', 'credit', `${Y}-12-22`],
        ['Английский язык', 'shestakova', 'credit', `${Y}-12-23`, 38, `${Y}-10-28`],
        ['Французский язык', 'zimina', 'credit', `${Y}-12-24`],
        ['Физическая культура', 'orlov', 'credit', `${Y}-12-21`, 40, `${Y}-10-29`, 'passed', `${Y}-10-29`],
        ['Введение в дипломатическую практику', 'dubrovin', 'credit', `${Y}-12-25`],
      ],
      [spring]: [
        ['Введение в теорию международных отношений', 'koroleva', 'exam', `${Y}-06-15`, 37, `${Y}-05-26`, '5', `${Y}-06-15`],
        ['История России', 'rudnev', 'exam', `${Y}-06-19`, 33, `${Y}-05-27`, '4', `${Y}-06-19`],
        ['Английский язык', 'shestakova', 'exam', `${Y}-06-24`, 39, `${Y}-05-25`, '5', `${Y}-06-24`],
        ['Французский язык', 'zimina', 'credit', `${Y}-06-03`, 35, `${Y}-05-28`, 'passed', `${Y}-06-03`],
        ['Основы права', 'gromova', 'credit', `${Y}-06-04`, 32, `${Y}-05-28`, 'passed', `${Y}-06-04`],
        ['Физическая культура', 'orlov', 'credit', `${Y}-06-02`, 40, `${Y}-05-20`, 'passed', `${Y}-06-02`],
        ['Информатика', 'lebedeva', 'credit', `${Y}-06-05`, 30, `${Y}-05-29`, 'passed', `${Y}-06-05`],
      ],
      social: {
        [spring]: [8, 'Староста группы', `${Y}-06-20`],
        [autumn]: [null, null, null, `${Y}-12-25`],
      },
      bonuses: {
        [spring]: [['sport', 'Секция волейбола МГИМО', 2, `${Y}-05-15`]],
        [autumn]: [
          ['volunteering', 'Волонтёр международной студенческой конференции', 2, `${Y}-10-15`],
          ['research', 'Статья в сборнике студенческих научных работ', 3, `${Y}-10-28`],
        ],
      },
    },
    'g.timofeev': {
      group: 'МЭО-3-07',
      [autumn]: [
        ['Макроэкономика', 'fomin', 'exam', `${N}-01-15`, 30, `${Y}-10-31`],
        ['Эконометрика', 'savchenko', 'exam', `${N}-01-20`],
        ['Мировая экономика', 'koroleva', 'exam', `${N}-01-26`, 35, `${Y}-11-01`],
        ['Международные валютно-кредитные отношения', 'gromova', 'exam', `${N}-01-29`, null, null, null, null, OVERDUE_CURRENT],
        ['Финансовые рынки', 'fomin', 'credit', `${Y}-12-22`],
        ['Английский язык', 'egorova', 'credit', `${Y}-12-24`, 36, `${Y}-10-27`],
        ['Физическая культура', 'orlov', 'credit', `${Y}-12-21`],
      ],
      [spring]: [
        ['Микроэкономика', 'fomin', 'exam', `${Y}-06-16`, 32, `${Y}-05-26`, '4', `${Y}-06-16`],
        ['Статистика', 'savchenko', 'exam', `${Y}-06-20`, 26, `${Y}-05-27`, '3', `${Y}-06-20`],
        ['Английский язык', 'egorova', 'exam', `${Y}-06-25`, 34, `${Y}-05-25`, '4', `${Y}-06-25`],
        ['Линейная алгебра', 'lebedeva', 'exam', `${Y}-06-12`, 38, `${Y}-05-22`, '5', `${Y}-06-12`],
        ['Бухгалтерский учёт', 'lebedeva', 'credit', `${Y}-06-03`, 31, `${Y}-05-28`, 'passed', `${Y}-06-03`],
        ['История экономических учений', 'rudnev', 'credit', `${Y}-06-05`, 18, `${Y}-05-29`, 'failed', `${Y}-06-05`],
        ['Физическая культура', 'orlov', 'credit', `${Y}-06-02`, 40, `${Y}-05-20`, 'passed', `${Y}-06-02`],
      ],
      social: {
        [spring]: [7, 'Участник студенческого научного общества', `${Y}-06-20`],
        [autumn]: [6, 'Член студенческого научного общества, участник Модели ООН', `${Y}-10-20`],
      },
      bonuses: {
        [spring]: [
          ['research', 'Доклад на студенческой конференции по экономике', 4, `${Y}-04-18`],
          ['volunteering', 'Волонтёр Дня открытых дверей', 1, `${Y}-03-22`],
        ],
        [autumn]: [['sport', 'Сборная МГИМО по баскетболу', 2, `${Y}-10-10`]],
      },
    },
  };

  let resultCount = 0;
  for (const [login, p] of Object.entries(plan)) {
    const studentId = userIdByLogin[login];
    for (const semesterId of [spring, autumn]) {
      const due = DUE[semesterId];
      for (const [discipline, teacher, control, examDate, pts = null, ptsAt = null, grade = null, gradeAt = null, currentDue] of p[semesterId]) {
        const assessmentId = insertAssessment.run(
          semesterId, p.group, disciplineIdFor(discipline), teacherId[teacher], control, 40,
          currentDue || due.current, due[control], examDate,
        ).lastInsertRowid;
        insertResult.run(studentId, assessmentId, pts, ptsAt, grade, gradeAt);
        resultCount += 1;
      }
      const [points, note, setAt, socialDue] = p.social[semesterId];
      insertSocial.run(studentId, semesterId, points, note, setAt, socialDue || setAt);
      for (const [category, title, points2, on] of p.bonuses[semesterId]) {
        insertBonus.run(studentId, semesterId, category, title, points2, on);
      }
    }
  }
  return { resultCount };
}

module.exports = { seedGrades };
