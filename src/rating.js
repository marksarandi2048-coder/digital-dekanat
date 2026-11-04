'use strict';
// Подсчёт рейтинга за семестр. УСЛОВНАЯ формула для прототипа —
// все правила собраны здесь, чтобы их было легко поменять.
//
//   Работа в семестре (Б1)        — до 40 баллов: сумма баллов по дисциплинам / сумма максимумов × 40
//   Сессия (Б2)                   — до 50 баллов: средний «процент» по экзаменам и зачётам × 50
//                                   (5 = 100 %, 4 = 80 %, 3 = 60 %, 2 и «не зачтено» = 0, «зачтено» = 100 %)
//   Общественная активность (Б3)  — до 10 баллов: баллы / максимум × 10
//   Надбавка                      — сверху, до +10
//
// Пока что-то не выставлено, оно считается как 0, а рейтинг помечается «предварительным».

const MAX = { work: 40, session: 50, social: 10, bonus: 10 };
const GRADE_SHARE = { 5: 1, 4: 0.8, 3: 0.6, 2: 0, passed: 1, failed: 0 };

const round1 = (n) => Math.round(n * 10) / 10;

function calculate({ disciplines, social, bonuses }) {
  const sumMax = disciplines.reduce((s, d) => s + d.currentMax, 0);
  const sumPoints = disciplines.reduce((s, d) => s + (d.currentPoints ?? 0), 0);
  const work = sumMax ? (sumPoints / sumMax) * MAX.work : 0;

  const sessionShare = disciplines.length
    ? disciplines.reduce((s, d) => s + (d.grade ? GRADE_SHARE[d.grade] : 0), 0) / disciplines.length
    : 0;
  const session = sessionShare * MAX.session;

  const socialPts = social && social.points !== null ? (social.points / social.maxPoints) * MAX.social : 0;
  const bonus = Math.min(MAX.bonus, bonuses.reduce((s, b) => s + b.points, 0));

  const blocks = [
    { key: 'work', label: 'Работа в семестре', points: round1(work), max: MAX.work },
    { key: 'session', label: 'Сессия', points: round1(session), max: MAX.session },
    { key: 'social', label: 'Общественная активность', points: round1(socialPts), max: MAX.social },
    { key: 'bonus', label: 'Надбавка', points: round1(bonus), max: MAX.bonus },
  ];
  const total = round1(work + session + socialPts + bonus);
  return { total, max: MAX.work + MAX.session + MAX.social, bonusMax: MAX.bonus, blocks };
}

// Статус одной оценки: выставлено / ожидается до … / срок прошёл.
function statusOf(value, setAt, due, today) {
  if (value !== null && value !== undefined) return { state: 'set', date: setAt };
  if (today <= due) return { state: 'pending', due };
  return { state: 'overdue', due };
}

module.exports = { calculate, statusOf, MAX };
