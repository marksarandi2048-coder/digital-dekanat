'use strict';
// Файл календаря .ics (стандарт RFC 5545) с занятиями группы.
// Открывается календарём телефона: iPhone, Android (Google Календарь), Outlook.
const { PUBLIC_URL } = require('./config');
const { tr } = require('./i18n');
const { dataText, personName } = require('./dataEn');

const kindLabel = (kind) => (['lecture', 'seminar', 'practice'].includes(kind) ? tr(`ics.kind_${kind}`) : '');

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
const place = (b, r) => `${dataText(b)}, ${/^\d+[а-яА-Яa-zA-Z]?$/.test(r) ? tr('ics.room', { room: r }) : dataText(r)}`;

function buildCalendar({ group: groupName, lessons, fmtSlot }) {
  const group = dataText(groupName);
  const host = new URL(PUBLIC_URL).host;
  const stamp = utcStamp();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tsifrovoy dekanat (kontsept MGIMOxAI Challenge)//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(tr('ics.calendar_name', { group }))}`,
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
    const kind = kindLabel(l.kind);
    const discipline = dataText(l.discipline);
    const cancelled = l.status === 'cancelled';
    const teacher = `${personName(l.teacher)}${l.teacherTitle ? `, ${dataText(l.teacherTitle)}` : ''}`;
    const notes = [tr('ics.pair_kind', { pair: l.pair, kind }), tr('ics.teacher', { teacher }), tr('ics.group', { group })];
    if (l.change) {
      if (l.status === 'moved') notes.push(tr('ics.moved_from', { slot: fmtSlot(l.change.oldDate, l.change.oldPair) }));
      if (l.status === 'room_changed') notes.push(tr('ics.room_changed', { place: place(l.change.oldBuilding, l.change.oldRoom) }));
      if (l.status === 'teacher_changed') notes.push(tr('ics.teacher_changed', { teacher: personName(l.change.oldTeacher) }));
      if (cancelled) notes.push(tr('ics.cancelled'));
      if (l.change.note) notes.push(dataText(l.change.note));
    }
    notes.push(tr('ics.concept'));

    lines.push(
      'BEGIN:VEVENT',
      `UID:lesson-${l.id}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Moscow:${local(l.date, l.time.start)}`,
      `DTEND;TZID=Europe/Moscow:${local(l.date, l.time.end)}`,
      `SUMMARY:${esc(`${cancelled ? tr('ics.cancelled_prefix') : ''}${discipline}${kind ? ` (${kind})` : ''}`)}`,
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
