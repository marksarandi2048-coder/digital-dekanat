'use strict';
// Вымышленная успеваемость для seed: прошлые семестры (всё выставлено)
// и текущий осенний (часть выставлена, часть ожидается, одна оценка просрочена).
// Прошлых семестров у студента столько, сколько он учится: у второкурсницы — два,
// у третьекурсника — четыре (весенний и осенний семестры прошлого года + первый курс).
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

  // Год назад: весенний семестр 1 курса для 3-курсника и осенний — первый семестр для 2-курсницы.
  const spring0 = insertSemester.run(`Весенний семестр ${Y - 2}/${yy(Y - 1)}`, `${Y - 1}-02-09`, `${Y - 1}-06-30`).lastInsertRowid;
  const autumn0 = insertSemester.run(`Осенний семестр ${Y - 1}/${yy(Y)}`, `${Y - 1}-09-01`, `${Y}-01-31`).lastInsertRowid;
  const spring = insertSemester.run(`Весенний семестр ${Y - 1}/${yy(Y)}`, `${Y}-02-09`, `${Y}-06-30`).lastInsertRowid;
  const autumn = insertSemester.run(`Осенний семестр ${Y}/${yy(N)}`, `${Y}-09-01`, `${N}-01-31`).lastInsertRowid;

  // Сроки (как договорились): баллы за семестр — до 19 декабря, зачёты — до 27 декабря,
  // экзамены — до 30 января. Для показа «срок прошёл» у одной дисциплины срок баллов — 31 октября.
  const DUE = {
    [autumn]: { current: `${Y}-12-19`, credit: `${Y}-12-27`, exam: `${N}-01-30` },
    [spring]: { current: `${Y}-05-30`, credit: `${Y}-06-10`, exam: `${Y}-06-30` },
    [autumn0]: { current: `${Y - 1}-12-19`, credit: `${Y - 1}-12-27`, exam: `${Y}-01-30` },
    [spring0]: { current: `${Y - 1}-05-30`, credit: `${Y - 1}-06-10`, exam: `${Y - 1}-06-30` },
  };
  const P = Y - 1; // год прошлой осени
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
      [autumn0]: [
        ['Всемирная история', 'rudnev', 'exam', `${Y}-01-16`, 36, `${P}-12-16`, '5', `${Y}-01-16`],
        ['Введение в политологию', 'koroleva', 'exam', `${Y}-01-21`, 31, `${P}-12-17`, '4', `${Y}-01-21`],
        ['Английский язык', 'shestakova', 'exam', `${Y}-01-26`, 37, `${P}-12-15`, '5', `${Y}-01-26`],
        ['Математика', 'lebedeva', 'exam', `${Y}-01-12`, 26, `${P}-12-18`, '3', `${Y}-01-12`],
        ['Французский язык', 'zimina', 'credit', `${P}-12-23`, 33, `${P}-12-16`, 'passed', `${P}-12-23`],
        ['Русский язык и культура речи', 'dubrovin', 'credit', `${P}-12-24`, 35, `${P}-12-17`, 'passed', `${P}-12-24`],
        ['Физическая культура', 'orlov', 'credit', `${P}-12-21`, 38, `${P}-12-10`, 'passed', `${P}-12-21`],
      ],
      social: {
        [autumn0]: [6, 'Участница программы адаптации первокурсников', `${Y}-01-20`],
        [spring]: [8, 'Староста группы', `${Y}-06-20`],
        [autumn]: [null, null, null, `${Y}-12-25`],
      },
      bonuses: {
        [autumn0]: [['volunteering', 'Волонтёр Дня открытых дверей', 1, `${P}-11-22`]],
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
      [spring0]: [
        ['Математический анализ', 'lebedeva', 'exam', `${P}-06-15`, 25, `${P}-05-26`, '3', `${P}-06-15`],
        ['Экономическая теория', 'savchenko', 'exam', `${P}-06-19`, 31, `${P}-05-27`, '4', `${P}-06-19`],
        ['Английский язык', 'egorova', 'exam', `${P}-06-24`, 33, `${P}-05-25`, '4', `${P}-06-24`],
        ['История России', 'rudnev', 'credit', `${P}-06-03`, 29, `${P}-05-28`, 'passed', `${P}-06-03`],
        ['Информатика', 'lebedeva', 'credit', `${P}-06-05`, 34, `${P}-05-29`, 'passed', `${P}-06-05`],
        ['Физическая культура', 'orlov', 'credit', `${P}-06-02`, 40, `${P}-05-20`, 'passed', `${P}-06-02`],
      ],
      [autumn0]: [
        ['Теория вероятностей', 'lebedeva', 'exam', `${Y}-01-14`, 34, `${P}-12-16`, '4', `${Y}-01-14`],
        ['Институциональная экономика', 'fomin', 'exam', `${Y}-01-19`, 37, `${P}-12-17`, '5', `${Y}-01-19`],
        ['Английский язык', 'egorova', 'exam', `${Y}-01-24`, 36, `${P}-12-15`, '5', `${Y}-01-24`],
        ['Экономическая история', 'rudnev', 'credit', `${P}-12-23`, 32, `${P}-12-16`, 'passed', `${P}-12-23`],
        ['Финансы', 'gromova', 'credit', `${P}-12-24`, 30, `${P}-12-17`, 'passed', `${P}-12-24`],
        ['Физическая культура', 'orlov', 'credit', `${P}-12-21`, 40, `${P}-12-10`, 'passed', `${P}-12-21`],
      ],
      social: {
        [spring0]: [5, 'Участник студенческого клуба дебатов', `${P}-06-20`],
        [autumn0]: [7, 'Участник студенческого научного общества', `${Y}-01-20`],
        [spring]: [7, 'Участник студенческого научного общества', `${Y}-06-20`],
        [autumn]: [6, 'Член студенческого научного общества, участник Модели ООН', `${Y}-10-20`],
      },
      bonuses: {
        [spring0]: [['sport', 'Сборная МГИМО по баскетболу', 2, `${P}-04-12`]],
        [autumn0]: [['research', 'Тезисы на студенческой конференции «Экономика и общество»', 3, `${P}-11-28`]],
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
    // Только семестры, в которых студент уже учился.
    for (const semesterId of [spring0, autumn0, spring, autumn].filter((id) => p[id])) {
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
  return { resultCount, semesterCount: 4 };
}

module.exports = { seedGrades };
