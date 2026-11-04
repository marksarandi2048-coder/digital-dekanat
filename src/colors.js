'use strict';
// Цвета дисциплин: у каждой дисциплины — свой цвет из палитры на 8 цветов,
// одинаковый в расписании, неделе и оценках.
// Правило: дисциплины, которые встречаются у одной группы в одном семестре,
// получают РАЗНЫЕ цвета. Раздаются один раз (в seed) и хранятся в базе.
const PALETTE_SIZE = 8;

function assignDisciplineColors(db) {
  // Наборы дисциплин, которые студент видит вместе: расписание группы
  // и дисциплины группы в каждом семестре.
  const sets = [
    ...db.prepare('SELECT group_name AS k, discipline_id AS d FROM lessons GROUP BY group_name, discipline_id').all(),
    ...db.prepare("SELECT group_name || '|' || semester_id AS k, discipline_id AS d FROM assessments").all(),
  ];
  const bySet = new Map();
  for (const { k, d } of sets) {
    if (!bySet.has(k)) bySet.set(k, new Set());
    bySet.get(k).add(d);
  }

  // Кто с кем «соседствует».
  const neighbours = new Map();
  for (const members of bySet.values()) {
    for (const a of members) {
      if (!neighbours.has(a)) neighbours.set(a, new Set());
      for (const b of members) if (a !== b) neighbours.get(a).add(b);
    }
  }

  // Раскраска: сначала дисциплины с наибольшим числом соседей, каждой — первый свободный цвет.
  const color = new Map();
  const order = [...neighbours.keys()].sort((a, b) => neighbours.get(b).size - neighbours.get(a).size || a - b);
  let conflicts = 0;
  for (const d of order) {
    const used = new Set([...neighbours.get(d)].map((n) => color.get(n)).filter((c) => c !== undefined));
    let c = 0;
    while (used.has(c) && c < PALETTE_SIZE) c += 1;
    if (c >= PALETTE_SIZE) {
      c = d % PALETTE_SIZE; // цветов не хватило — повтор неизбежен
      conflicts += 1;
    }
    color.set(d, c);
  }

  const update = db.prepare('UPDATE disciplines SET color = ? WHERE id = ?');
  db.transaction(() => {
    for (const [d, c] of color) update.run(c, d);
  })();
  return { colored: color.size, conflicts };
}

// Для дисциплины без сохранённого цвета (например, добавленной позже).
const colorOf = (row) => (row.discipline_color ?? row.discipline_id % PALETTE_SIZE);

module.exports = { assignDisciplineColors, colorOf, PALETTE_SIZE };
