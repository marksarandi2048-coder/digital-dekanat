'use strict';
// Даты в формате ГГГГ-ММ-ДД. «Сегодня» считается по московскому времени,
// чтобы не зависеть от часового пояса сервера.
const TIME_ZONE = 'Europe/Moscow';

function nowInMoscow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

function addDays(str, days) {
  const d = new Date(`${str}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Понедельник той недели, в которую входит дата.
function mondayOf(str) {
  const day = new Date(`${str}T00:00:00Z`).getUTCDay(); // 0 — воскресенье
  return addDays(str, day === 0 ? -6 : 1 - day);
}

// Текущее время в Москве строкой «ГГГГ-ММ-ДД ЧЧ:ММ».
function nowStamp() {
  const n = nowInMoscow();
  return `${n.date} ${n.time}`;
}

module.exports = { nowInMoscow, nowStamp, isValidDate, addDays, mondayOf };
