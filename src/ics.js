'use strict';
// Файл календаря .ics (стандарт RFC 5545) с занятиями группы.
// Открывается календарём телефона: iPhone, Android (Google Календарь), Outlook.
const { PUBLIC_URL } = require('./config');

const KIND = { lecture: 'лекция', seminar: 'семинар', practice: 'практическое занятие' };

// Спецсимволы в тексте экранируются по стандарту.
const esc = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Строки длиннее 75 байт переносятся (с пробелом в начале продолжения),
// не разрывая русские буквы посередине (в UTF-8 они занимают 2 байта).
function fold(line) {
  const out = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    const limit = out.length === 0 ? 75 : 74; // у продолжения 1 байт занимает пробел
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join('\r\n');
}

const local = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
const utcStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const place = (b, r) => `${b}, ${/^\d+[а-яА-Яa-zA-Z]?$/.test(r) ? `ауд. ${r}` : r}`;

function buildCalendar({ group, lessons, fmtSlot }) {
  const host = new URL(PUBLIC_URL).host;
  const stamp = utcStamp();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tsifrovoy dekanat (kontsept MGIMOxAI Challenge)//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`Расписание ${group}`)}`,
    'X-WR-TIMEZONE:Europe/Moscow',
    // Москва: +03:00 круглый год, без перехода на летнее время.
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Moscow',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0300',
    'TZNAME:MSK',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const l of lessons) {
    const kind = KIND[l.kind] || '';
    const cancelled = l.status === 'cancelled';
    const notes = [`${l.pair} пара, ${kind}`, `Преподаватель: ${l.teacher}${l.teacherTitle ? `, ${l.teacherTitle}` : ''}`, `Группа ${group}`];
    if (l.change) {
      if (l.status === 'moved') notes.push(`Перенесено с: ${fmtSlot(l.change.oldDate, l.change.oldPair)}`);
      if (l.status === 'room_changed') notes.push(`Аудитория изменена, было: ${place(l.change.oldBuilding, l.change.oldRoom)}`);
      if (l.status === 'teacher_changed') notes.push(`Замена преподавателя, вместо: ${l.change.oldTeacher}`);
      if (cancelled) notes.push('Занятие отменено');
      if (l.change.note) notes.push(l.change.note);
    }
    notes.push('Концепт для конкурса MGIMO×AI Challenge, не официальный сервис МГИМО. Данные вымышлены.');

    lines.push(
      'BEGIN:VEVENT',
      `UID:lesson-${l.id}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Moscow:${local(l.date, l.time.start)}`,
      `DTEND;TZID=Europe/Moscow:${local(l.date, l.time.end)}`,
      `SUMMARY:${esc(`${cancelled ? 'ОТМЕНЕНО: ' : ''}${l.discipline}${kind ? ` (${kind})` : ''}`)}`,
      `LOCATION:${esc(place(l.building, l.room))}`,
      `DESCRIPTION:${esc(notes.join('\n'))}`,
      `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

module.exports = { buildCalendar, fold };
