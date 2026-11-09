'use strict';
// Калькулятор «Что нужно на экзамене». Только расчёт: в базу ничего не записывается.
// Формула — та же, что у настоящего рейтинга (calculate из rating.js).
const { calculate } = require('./rating');
const { listSemesters, semesterData } = require('./grades');

const ALLOWED = { exam: ['5', '4', '3'], credit: ['passed', 'failed'] };
const TARGET_MAX = 110; // 100 баллов и надбавка до +10
const hasPoints = (d) => d.currentPoints !== null && d.currentPoints !== undefined;
const round1 = (n) => Math.round(n * 10) / 10;

// Невыставленные баллы за семестр в настоящем рейтинге равны 0, и прогноз был бы занижен.
// Поэтому здесь они заменяются средним процентом по уже выставленным.
function fillMissingPoints(disciplines) {
  const set = disciplines.filter(hasPoints);
  const setMax = set.reduce((s, d) => s + d.currentMax, 0);
  const share = setMax ? set.reduce((s, d) => s + d.currentPoints, 0) / setMax : null;
  return {
    assumed: { count: disciplines.length - set.length, percent: share === null ? null : Math.round(share * 100) },
    disciplines: disciplines.map((d) => (hasPoints(d) ? d : { ...d, currentPoints: d.currentMax * (share ?? 0) })),
  };
}

// В расчёт идут только выборы по своим экзаменам и зачётам без оценки — и только допустимые.
function cleanChoices(open, choices) {
  const picked = {};
  if (!choices || typeof choices !== 'object') return picked;
  for (const d of open) {
    const value = Object.hasOwn(choices, String(d.id)) ? choices[d.id] : undefined;
    if (ALLOWED[d.control].includes(value)) picked[d.id] = value;
  }
  return picked;
}

function parseTarget(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= TARGET_MAX ? n : null;
}

// Обратный режим: самые низкие оценки, которых хватает. Все зачёты считаются сданными.
// В формуле важно только число оценок каждого вида, поэтому перебираем количества.
function solveTarget(target, open, totalWith) {
  const exams = open.filter((d) => d.control === 'exam');
  const credits = open.filter((d) => d.control === 'credit');
  const n = exams.length;
  const build = (fives, fours) => {
    const choices = {};
    credits.forEach((d) => { choices[d.id] = 'passed'; });
    exams.forEach((d, i) => { choices[d.id] = i < fives ? '5' : i < fives + fours ? '4' : '3'; });
    return choices;
  };

  let best = null;
  for (let fives = 0; fives <= n; fives += 1) {
    for (let fours = 0; fours <= n - fives; fours += 1) {
      const choices = build(fives, fours);
      const total = totalWith(choices);
      if (total < target) continue;
      const effort = fives * 5 + fours * 4 + (n - fives - fours) * 3;
      if (!best || effort < best.effort || (effort === best.effort && fives < best.fives)) {
        best = { effort, fives, fours, total, choices };
      }
    }
  }
  if (!best) return { reachable: false, max: totalWith(build(n, 0)) };
  return {
    reachable: true,
    total: best.total,
    counts: { 5: best.fives, 4: best.fours, 3: n - best.fives - best.fours },
    credits: credits.length,
    choices: best.choices,
  };
}

function forecast(student, today, input = {}) {
  const semester = listSemesters(today).find((s) => s.isCurrent);
  if (!semester) return null;
  const data = semesterData(student, semester.id, today);
  const { assumed, disciplines } = fillMissingPoints(data.disciplines);
  const open = data.disciplines.filter((d) => !d.grade);

  const totalWith = (choices) => calculate({
    disciplines: disciplines.map((d) => (choices[d.id] ? { ...d, grade: choices[d.id] } : d)),
    social: data.social,
    bonuses: data.bonuses,
  }).total;

  const base = totalWith({});
  const total = totalWith(cleanChoices(open, input.choices));
  const target = parseTarget(input.target);
  return {
    max: data.rating.max,
    base,
    total,
    delta: round1(total - base),
    assumed,
    target: target === null ? null : solveTarget(target, open, totalWith),
  };
}

module.exports = { forecast };
