'use strict';
// «Что взять с собой»: правила по дисциплине. Чтобы поправить подсказку —
// достаточно изменить этот список. kind (необязательно) — только для такого вида
// занятия: lecture, seminar или practice.
const RULES = [
  { discipline: 'Физическая культура', items: ['спортивная форма', 'сменная обувь'] },
  { discipline: 'Английский язык', items: ['учебник', 'рабочая тетрадь'] },
  { discipline: 'Французский язык', items: ['учебник', 'рабочая тетрадь'] },
  { discipline: 'Эконометрика', kind: 'practice', items: ['флешка с данными'] },
  { discipline: 'Макроэкономика', kind: 'seminar', items: ['калькулятор'] },
  { discipline: 'Финансовые рынки', kind: 'seminar', items: ['калькулятор'] },
  { discipline: 'Международное право', kind: 'seminar', items: ['сборник документов'] },
];

// Что взять на занятия дня: по одной строке на дисциплину.
// until — конец последней пары по этой дисциплине: после него подсказка уже не нужна.
function bringFor(lessons) {
  const byDiscipline = new Map();
  for (const lesson of lessons) {
    if (lesson.status === 'cancelled') continue;
    const rules = RULES.filter((r) => r.discipline === lesson.discipline && (!r.kind || r.kind === lesson.kind));
    if (!rules.length) continue;
    const entry = byDiscipline.get(lesson.discipline) || {
      discipline: lesson.discipline,
      shortName: lesson.shortName,
      color: lesson.color,
      items: [],
      until: lesson.time.end,
    };
    for (const item of rules.flatMap((r) => r.items)) {
      if (!entry.items.includes(item)) entry.items.push(item);
    }
    if (lesson.time.end > entry.until) entry.until = lesson.time.end;
    byDiscipline.set(lesson.discipline, entry);
  }
  return [...byDiscipline.values()];
}

module.exports = { bringFor };
