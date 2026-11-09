'use strict';
// Серверные функции помощника. Модель выбирает функцию, а выполняет её сервер.
//
// Главное правило: НИ У ОДНОЙ функции нет параметра «какой студент» или «какая группа».
// Студент всегда один — вошедший, он передаётся сюда из сессии. Поэтому получить чужие данные
// через помощника нельзя, что бы ни попросили у модели. Все функции только читают данные.
//
// В модель уходит минимум: без ФИО студента, логина, номера студента, группы и комментариев.
const { tr, currentLang, currentLocale } = require('./i18n');
const { translated } = require('./dataEn');
const { getSchedule } = require('./schedule');
const { listSemesters, semesterData } = require('./grades');
const { deadlines } = require('./notifications');
const { listForStudent, toListItem } = require('./requests');
const { statusHint } = require('./requestTypes');
const bonus = require('./bonus');
const appointments = require('./appointments');
const { search } = require('./faqSearch');
const { forecast } = require('./forecast');
const { nowInMoscow, isValidDate, addDays, mondayOf } = require('./dates');

const MAX_LESSONS = 40;
const MAX_LIST = 20;
const MAX_OPPORTUNITIES = 15;
const QUERY_MAX = 200;
const FREE_TEXT_MAX = 200;

// Кнопки выбирает сервер по тому, какие сведения понадобились для ответа. Модель на них не влияет:
// ни ссылку, ни подпись подсунуть нельзя. Кнопка лишь открывает страницу, отправляет форму сам студент.
const ACTIONS = {
  order_certificate: { label: 'assistant.action.order_certificate', href: '/requests/new?type=study_certificate' },
  order_enrollment_certificate: { label: 'assistant.action.order_enrollment_certificate', href: '/requests/new?type=enrollment_certificate' },
  order_extract: { label: 'assistant.action.order_extract', href: '/requests/new?type=order_extract' },
  write_to_dean: { label: 'assistant.action.write_to_dean', href: '/requests/new?type=appeal' },
  book_appointment: { label: 'assistant.action.book_appointment', href: '/appointments' },
  open_week: { label: 'assistant.action.open_week', href: '/week' },
  open_today: { label: 'assistant.action.open_today', href: '/today' },
  open_grades: { label: 'assistant.action.open_grades', href: '/grades' },
  open_calculator: { label: 'assistant.action.open_calculator', href: '/grades#forecast' },
  open_requests: { label: 'assistant.action.open_requests', href: '/requests' },
  open_bonus: { label: 'assistant.action.open_bonus', href: '/grades/bonus' },
  open_student_card: { label: 'assistant.action.open_student_card', href: '/student-card' },
};
const ACTION_BY_HREF = Object.fromEntries(Object.entries(ACTIONS).map(([id, a]) => [a.href, id]));
const ACTIONS_FOR_TOOL = {
  get_schedule: ['open_week'],
  get_grades: ['open_grades'],
  get_forecast: ['open_calculator'],
  get_requests: ['order_certificate', 'open_requests'],
  get_bonus: ['open_bonus'],
  get_appointments: ['book_appointment'],
};

const noParams = { type: 'object', properties: {} };

const TOOLS = [
  {
    name: 'get_schedule',
    description: 'Расписание занятий студента: аудитории, преподаватели, переносы, отмены и замены. Используй для любых вопросов о парах.',
    parameters: {
      type: 'object',
      properties: {
        when: {
          type: 'string',
          enum: ['today', 'tomorrow', 'this_week', 'next_week', 'date'],
          description: 'За какой период. date — конкретный день, тогда заполни поле date.',
        },
        date: { type: 'string', description: 'Дата в формате ГГГГ-ММ-ДД, только если when = date.' },
      },
      required: ['when'],
    },
  },
  {
    name: 'get_grades',
    description: 'Оценки студента, баллы за семестр, зачёты, экзамены, долги и рейтинг. Используй для вопросов об успеваемости.',
    parameters: {
      type: 'object',
      properties: { semester: { type: 'string', enum: ['current', 'previous'], description: 'Текущий или прошлый семестр.' } },
      required: ['semester'],
    },
  },
  {
    name: 'get_forecast',
    description: 'Калькулятор рейтинга: какие оценки нужны на оставшихся экзаменах, чтобы выйти на нужный рейтинг, и какой рейтинг получится при таких-то оценках. Вызывай на любые вопросы вида «что нужно для 85», «какой будет рейтинг, если получу все пятёрки», «хватит ли троек», «are threes enough». Обязательно передай результат студенту, правила здесь искать не нужно.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['need_for_target', 'all_exams_grade'],
          description: 'need_for_target — какие оценки нужны для рейтинга target. all_exams_grade — какой рейтинг получится, если все оставшиеся экзамены сданы на exam_grade.',
        },
        target: { type: 'number', description: 'Желаемый рейтинг, число от 0 до 110. Обязательно для need_for_target. Для all_exams_grade — только если студент назвал цель, в том числе раньше в разговоре.' },
        exam_grade: { type: 'string', enum: ['5', '4', '3'], description: 'Оценка за все оставшиеся экзамены. Только для all_exams_grade: «все пятёрки» — 5, «четвёрки» — 4, «тройки» — 3.' },
      },
      required: ['mode'],
    },
  },
  {
    name: 'get_deadlines',
    description: 'Ближайшие сроки: объявления деканата, экзамены, зачёты, сроки выставления оценок. Поле own = true значит, что действие нужно от самого студента.',
    parameters: noParams,
  },
  {
    name: 'get_requests',
    description: 'Заявки и справки студента и их текущие статусы. Вызывай и тогда, когда студент хочет заказать справку.',
    parameters: noParams,
  },
  {
    name: 'get_bonus',
    description: 'Надбавка — это дополнительные баллы рейтинга за волонтёрство, спорт и науку, а не деньги и не стипендия. Функция показывает, сколько баллов набрано, записи студента на активности и где ещё можно заработать баллы.',
    parameters: noParams,
  },
  {
    name: 'get_appointments',
    description: 'Записи студента на приём в деканат и дни со свободным временем. Вызывай и тогда, когда студент хочет записаться на приём.',
    parameters: noParams,
  },
  {
    name: 'search_help',
    description: 'Поиск по базе ответов деканата: правила и порядок действий (академический отпуск, общежитие, стипендия, пересдача, пароль, справки). Используй для вопросов «как оформить», «где получить». Не используй для расчёта оценок и рейтинга: для этого есть get_forecast.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Вопрос своими словами.' } },
      required: ['query'],
    },
  },
];

const clip = (text, max = FREE_TEXT_MAX) => (typeof text === 'string' ? text.slice(0, max) : text);
const weekday = (date) => new Intl.DateTimeFormat(currentLocale(), { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${date}T00:00:00Z`));

function scheduleRange(args, today) {
  if (args.when === 'tomorrow') return [addDays(today, 1), addDays(today, 1)];
  if (args.when === 'this_week') return [mondayOf(today), addDays(mondayOf(today), 6)];
  if (args.when === 'next_week') return [addDays(mondayOf(today), 7), addDays(mondayOf(today), 13)];
  if (args.when === 'date' && isValidDate(args.date)) return [args.date, args.date];
  return [today, today];
}

function lessonFacts(lesson) {
  const facts = {
    date: lesson.date,
    weekday: weekday(lesson.date),
    pair: lesson.pair,
    start: lesson.time && lesson.time.start,
    end: lesson.time && lesson.time.end,
    discipline: lesson.discipline,
    kind: lesson.kind,
    teacher: lesson.teacher,
    building: lesson.building,
    room: lesson.room,
    status: lesson.status,
  };
  if (lesson.change) {
    facts.change = {
      oldDate: lesson.change.oldDate,
      oldStart: lesson.change.oldTime && lesson.change.oldTime.start,
      oldBuilding: lesson.change.oldBuilding,
      oldRoom: lesson.change.oldRoom,
      oldTeacher: lesson.change.oldTeacher,
      note: clip(lesson.change.note),
    };
  }
  return facts;
}

function getScheduleTool(user, args) {
  if (!user.group_name) return { lessons: [], moved_away: [] };
  const today = nowInMoscow().date;
  const [from, to] = scheduleRange(args, today);
  const { lessons, movedAway } = getSchedule(user.group_name, from, to);
  return {
    period: { from, to },
    lessons: lessons.slice(0, MAX_LESSONS).map(lessonFacts),
    moved_away: movedAway.slice(0, MAX_LESSONS).map((l) => ({
      old_date: l.change && l.change.oldDate,
      old_start: l.change && l.change.oldTime && l.change.oldTime.start,
      discipline: l.discipline,
      new_date: l.date,
      new_start: l.time && l.time.start,
    })),
  };
}

const gradeLabel = (grade) => {
  if (grade === 'passed') return tr('grades.zachteno');
  if (grade === 'failed') return tr('grades.ne_zachteno');
  return grade;
};

function getGradesTool(user, args) {
  const today = nowInMoscow().date;
  const semesters = listSemesters(today);
  const currentIndex = semesters.findIndex((s) => s.isCurrent);
  const semester = args.semester === 'previous' ? semesters[currentIndex + 1] : semesters[currentIndex];
  if (!semester) return { semester: null, disciplines: [] };
  const data = semesterData(user, semester.id, today);
  return {
    semester: semester.name,
    disciplines: data.disciplines.map((d) => ({
      discipline: d.discipline,
      control: d.control === 'exam' ? tr('grades.ekzamen') : tr('grades.zachet'),
      examDate: d.examDate,
      semesterPoints: d.currentPoints,
      semesterPointsMax: d.currentMax,
      semesterPointsState: d.currentStatus.state,
      semesterPointsDue: d.currentStatus.due,
      grade: gradeLabel(d.grade),
      gradeState: d.gradeStatus.state,
      gradeDue: d.gradeStatus.due,
    })),
    rating: {
      isFinal: data.summary.isFinal,
      earnedSoFar: data.rating.soFar.points,
      possibleSoFar: data.rating.soFar.possible,
      percentSoFar: data.rating.soFar.percent,
      ratingOutOf100: data.rating.total,
      bonus: data.rating.bonus,
      bonusMax: data.rating.bonusMax,
    },
    summary: {
      gradesTotal: data.summary.gradesTotal,
      gradesSet: data.summary.gradesSet,
      overdue: data.summary.overdue,
      outstandingDebts: data.summary.debts,
    },
  };
}

function plural(n, one, few, many) {
  if (currentLang() === 'en') return n === 1 ? one : many;
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const decimal = (n) => (currentLang() === 'en' ? String(n) : String(n).replace('.', ','));

// Те же слова, что в калькуляторе на странице «Оценки» (public/js/forecast.js).
function countsText(plan) {
  const parts = [
    [plan.counts[5], tr('forecast.pyaterka'), tr('forecast.pyaterki'), tr('forecast.pyaterok')],
    [plan.counts[4], tr('forecast.chetverka'), tr('forecast.chetverki'), tr('forecast.chetverok')],
    [plan.counts[3], tr('forecast.troyka'), tr('forecast.troyki'), tr('forecast.troek')],
  ].filter(([n]) => n > 0).map(([n, one, few, many]) => `${n} ${plural(n, one, few, many)}`);
  if (plan.credits) parts.push(plan.credits === 1 ? tr('forecast.sdat_zachet') : tr('forecast.sdat_vse_zachety'));
  return parts.join(', ');
}

// Калькулятор подставляет средний результат вместо невыставленных баллов: об этом надо сказать.
function assumedNote(assumed) {
  if (!assumed.count) return '';
  if (assumed.percent === null) return ` ${tr('forecast.bally_za_semestr_esche')}`;
  const where = `${assumed.count} ${plural(assumed.count, tr('forecast.distsipline'), tr('forecast.distsiplinam'), tr('forecast.distsiplinam'))}`;
  return ` ${tr('forecast.bally_za_semestr_esche_2', { where, percent: assumed.percent })}`;
}

function targetSummary(plan, open) {
  if (!plan.reachable) {
    const what = open.exams ? tr('forecast.pri_vsekh_pyaterkakh') : tr('forecast.esli_sdat_vse_zachety');
    return tr('forecast.nedostizhimo_dazhe_what_poluchitsya', { what, p1: decimal(plan.max) });
  }
  return `${tr('forecast.dostatochno')}${tr('forecast.p0_poluchitsya_p1', { p0: countsText(plan), p1: decimal(plan.total) })}`;
}

function scenarioSummary(result, target) {
  const { scenario, open } = result;
  const total = decimal(scenario.total);
  let text;
  if (open.exams) {
    const key = open.credits ? 'assistant.forecast.exams_and_credits' : 'assistant.forecast.exams_only';
    text = tr(key, { grades: tr(`assistant.forecast.grade_${scenario.grade}`), total });
  } else {
    text = tr('assistant.forecast.credits_only', { total });
  }
  if (target === null) return `${text} ${tr('assistant.forecast.ask_target')}`;
  return `${text} ${tr(scenario.total >= target ? 'assistant.forecast.enough' : 'assistant.forecast.not_enough', { target: decimal(target) })}`;
}

// Цель могла прозвучать раньше: «Хочу рейтинг 85» → «а хватит ли троек?».
const TARGET_IN_TEXT = /(?:рейтинг\D{0,15}|выйти на\s*|набрать\s*|для\s+|reach\s+|rating\s+(?:of\s+)?|target\s+(?:of\s+)?)(\d{2,3})\b/i;

function targetFromConversation(texts) {
  for (const text of texts) {
    const found = text.match(TARGET_IN_TEXT);
    if (found) return Number(found[1]);
  }
  return null;
}

function getForecastTool(user, args, conversation = []) {
  const given = typeof args.target === 'number' || typeof args.target === 'string' ? args.target : null;
  const target = given === null && args.mode === 'all_exams_grade' ? targetFromConversation(conversation) : given;
  const allExams = args.mode === 'all_exams_grade' ? String(args.exam_grade) : null;
  const result = forecast(user, nowInMoscow().date, { target, allExams });
  if (!result) return { error: 'no_current_semester' };
  if (!result.open.exams && !result.open.credits) {
    return { exactAnswer: tr('assistant.forecast.all_set', { total: decimal(result.base) }) };
  }
  const note = assumedNote(result.assumed);
  if (args.mode === 'need_for_target') {
    if (!result.target) return { error: 'target_required', allowed: '0-110' };
    return { exactAnswer: `${targetSummary(result.target, result.open)}${note}` };
  }
  if (!result.scenario) return { error: 'exam_grade_required', allowed: ['5', '4', '3'] };
  const asked = result.target ? Number(target) : null;
  return { exactAnswer: `${scenarioSummary(result, asked)}${note}` };
}

function getDeadlinesTool(user) {
  return {
    deadlines: deadlines(user, nowInMoscow().date).slice(0, MAX_LIST).map((d) => ({
      date: d.date,
      daysLeft: d.daysLeft,
      title: clip(d.title),
      note: d.note,
      own: d.own,
    })),
  };
}

function getRequestsTool(user) {
  return {
    requests: listForStudent(user.id).slice(0, MAX_LIST).map((row) => {
      const item = toListItem(row);
      return {
        number: String(item.id),
        type: item.typeLabel,
        title: clip(item.title),
        format: item.format,
        status: item.statusLabel,
        statusHint: statusHint(row.status, row),
        closed: item.closed,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    }),
  };
}

function getBonusTool(user) {
  const view = bonus.studentView(user, nowInMoscow().date);
  return {
    progress: view.progress,
    myActivities: view.mine.slice(0, MAX_LIST).map((m) => ({ title: clip(m.title), category: m.category, points: m.points, status: m.status })),
    openOpportunities: view.opportunities.filter((o) => o.open).slice(0, MAX_OPPORTUNITIES).map((o) => ({
      title: clip(o.title),
      category: o.category,
      points: o.points,
      signupUntil: o.signupUntil,
      eventOn: o.eventOn,
      alreadyEnrolled: Boolean(o.status),
    })),
  };
}

function getAppointmentsTool(user) {
  const view = appointments.studentView(user, nowInMoscow());
  return {
    myAppointments: view.appointments.slice(0, MAX_LIST).map((a) => ({
      date: a.date,
      time: a.time,
      topic: a.topic,
      place: a.place,
      status: a.status,
      canChange: a.canChange,
    })),
    receptionDays: view.days.map((d) => ({ date: d.date, freeSlots: d.free, closedReason: clip(d.closed), hasMyAppointment: d.mine })),
  };
}

function searchHelpTool(user, args) {
  const query = typeof args.query === 'string' ? args.query.slice(0, QUERY_MAX) : '';
  if (!query.trim()) return { results: [] };
  return {
    results: search(query).map((r) => ({
      question: r.question,
      answer: r.answer,
      action: (r.action && ACTION_BY_HREF[r.action.href]) || null,
    })),
  };
}

const RUNNERS = {
  get_schedule: getScheduleTool,
  get_grades: getGradesTool,
  get_forecast: getForecastTool,
  get_deadlines: getDeadlinesTool,
  get_requests: getRequestsTool,
  get_bonus: getBonusTool,
  get_appointments: getAppointmentsTool,
  search_help: searchHelpTool,
};

function parseArguments(raw) {
  let args = raw;
  if (typeof raw === 'string') {
    try {
      args = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return args && typeof args === 'object' && !Array.isArray(args) ? args : {};
}

// Выполняет функцию от имени вошедшего студента. user приходит только из сессии.
// conversation — вопросы студента в этом разговоре, от нового к старому.
function runTool(name, rawArgs, user, conversation) {
  if (!user || user.role !== 'student') return { error: 'forbidden' };
  if (!Object.hasOwn(RUNNERS, name)) return { error: 'unknown_function' };
  const result = RUNNERS[name](user, parseArguments(rawArgs), conversation);
  return currentLang() === 'en' ? translated(result) : result;
}

// Какие кнопки предложить после вызова функции. У базы ответов кнопка берётся из лучшего ответа.
function actionsAfterTool(name, result) {
  if (name === 'search_help') {
    const top = result.results && result.results[0];
    return top && top.action ? [top.action] : [];
  }
  return Object.hasOwn(ACTIONS_FOR_TOOL, name) ? ACTIONS_FOR_TOOL[name] : [];
}

function actionButtons(ids) {
  return [...new Set(ids)].slice(0, 3).map((id) => ({ id, label: tr(ACTIONS[id].label), href: ACTIONS[id].href }));
}

module.exports = { TOOLS, runTool, actionsAfterTool, actionButtons };
