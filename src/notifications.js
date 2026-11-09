'use strict';
const { tr, currentLocale } = require('./i18n');
// Лента уведомлений студента и «Ближайшие дедлайны».
// Автоматические уведомления собираются на лету из уже существующих данных
// (расписание, заявки, оценки, объявления). В базе хранятся только отметки «прочитано».
// Всё строится для ОДНОГО пользователя — того, кто вошёл (user из сессии).
const { db } = require('./db');
const { addDays, mondayOf, nowStamp } = require('./dates');
const { pairsFor } = require('./pairs');
const T = require('./requestTypes');
const { listSemesters, semesterData } = require('./grades');
const { eventsFor: bonusEvents } = require('./bonus');
const { reminders: appointmentReminders } = require('./appointments');

const REMIND_DAYS = 7; // за сколько дней до срока напоминать
const HISTORY_DAYS = 30; // сколько дней истории заявок показывать

const q = {
  announcements: db.prepare(`
    SELECT * FROM announcements
    WHERE removed_at IS NULL
      AND (faculty IS NULL OR faculty = @faculty)
      AND (course IS NULL OR course = @course)
      AND (group_name IS NULL OR group_name = @group)
    ORDER BY created_at DESC`),
  lessonChanges: db.prepare(`
    SELECT l.*, d.name AS discipline, t.full_name AS teacher, ot.full_name AS old_teacher
    FROM lessons l
    JOIN disciplines d ON d.id = l.discipline_id
    JOIN teachers t ON t.id = l.teacher_id
    LEFT JOIN teachers ot ON ot.id = l.old_teacher_id
    WHERE l.group_name = @group AND l.status != 'normal' AND l.changed_at IS NOT NULL
      AND (l.date >= @today OR l.old_date >= @today)`),
  requestEvents: db.prepare(`
    SELECT e.id, e.status, e.at, e.note, e.actor_id, r.id AS request_id, r.type, r.format, r.order_ref, r.subject,
           r.pickup_place, r.pickup_hours, r.reject_reason
    FROM request_events e JOIN requests r ON r.id = e.request_id
    WHERE r.student_id = @id AND e.actor_id != @id AND e.at >= @since`),
  staffMessages: db.prepare(`
    SELECT m.id, m.text, m.created_at, m.author_id, r.id AS request_id, r.type, r.order_ref, r.subject
    FROM request_messages m JOIN requests r ON r.id = m.request_id
    WHERE r.student_id = @id AND m.author_id != @id AND m.created_at >= @since`),
  faculty: db.prepare('SELECT faculty FROM groups WHERE name = ?'),
  reads: db.prepare('SELECT item_key FROM notification_reads WHERE user_id = ?'),
  markRead: db.prepare('INSERT OR IGNORE INTO notification_reads (user_id, item_key, read_at) VALUES (?, ?, ?)'),
};

// ---------- Оформление дат по-русски (на сервере) ----------
const fmt = (d, o) => new Intl.DateTimeFormat(currentLocale(), { timeZone: 'UTC', ...o }).format(new Date(`${d}T00:00:00Z`));
const dayLabel = (d) => fmt(d, { weekday: 'short', day: 'numeric', month: 'long' });
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const shortName = (n) => {
  if (!n) return '';
  const [last, ...rest] = n.split(/\s+/);
  return [last, ...rest.map((p) => `${p[0]}.`)].join(' ');
};
const preview = (t, n = 160) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

function audienceMatches(a, user) {
  return (
    !a.removed_at &&
    (a.faculty === null || a.faculty === user.faculty) &&
    (a.course === null || a.course === user.course) &&
    (a.group_name === null || a.group_name === user.group_name)
  );
}

function requestTitle(r) {
  if (r.type === 'appeal') return tr('notifications.obraschenie_v_dekanat');
  if (r.type === 'order_extract') return tr('notifications.vypiska_iz_prikaza_p0', { p0: r.order_ref ? `«${r.order_ref}»` : '' }).trim();
  return T.TYPES[r.type].label;
}

// ---------- Ближайшие дедлайны ----------
// own: true — сделать должен сам студент; false — ждём от преподавателя.
function deadlines(user, today) {
  const out = [];
  for (const a of q.announcements.all({ faculty: user.faculty, course: user.course, group: user.group_name })) {
    if (a.deadline_on && a.deadline_on >= today) {
      out.push({ key: `announcement:${a.id}`, date: a.deadline_on, title: a.title, note: tr('notifications.obyavlenie_dekanata'), own: true, link: `/announcements/${a.id}` });
    }
  }

  const current = listSemesters(today).find((s) => s.isCurrent);
  if (current) {
    const data = semesterData(user, current.id, today);
    for (const d of data.disciplines) {
      if (d.examDate && d.examDate >= today && !d.grade) {
        out.push({
          key: `exam:${d.id}`,
          date: d.examDate,
          title: `${d.control === 'exam' ? tr('notifications.ekzamen') : tr('notifications.zachet')}: ${d.discipline}`,
          note: tr('notifications.sessiya'),
          own: true,
          link: '/grades',
        });
      }
    }
    // Сроки выставления оценок — сгруппированы по дате, чтобы не было десяти одинаковых строк.
    const waiting = new Map();
    const addWaiting = (what, due) => {
      const k = `${what}|${due}`;
      waiting.set(k, { what, due, n: (waiting.get(k)?.n || 0) + 1 });
    };
    for (const d of data.disciplines) {
      if (d.currentStatus.state === 'pending') addWaiting(tr('notifications.bally_za_semestr'), d.currentStatus.due);
      if (d.gradeStatus.state === 'pending') addWaiting(d.control === 'exam' ? tr('notifications.otsenki_za_ekzameny') : tr('notifications.otsenki_za_zachety'), d.gradeStatus.due);
    }
    if (data.social && data.social.status.state === 'pending') addWaiting(tr('notifications.obschestvennaya_aktivnost'), data.social.status.due);
    for (const w of waiting.values()) {
      out.push({
        key: `waiting:${w.what}:${w.due}`,
        date: w.due,
        title: w.n > 1 ? `${w.what}: ${w.n} ${w.n < 5 ? tr('notifications.distsipliny') : tr('notifications.distsiplin')}` : w.what,
        note: tr('notifications.ozhidaetsya_ot_prepodavatelya'),
        own: false,
        link: '/grades',
      });
    }
  }

  return out
    .map((d) => ({ ...d, daysLeft: daysBetween(today, d.date) }))
    .sort((a, b) => a.date.localeCompare(b.date) || Number(b.own) - Number(a.own));
}

// ---------- Лента ----------
function feed(user, today) {
  const items = [];
  const facultyOfGroup = q.faculty.get(user.group_name);
  const pairs = pairsFor(facultyOfGroup ? facultyOfGroup.faculty : user.faculty);
  const slot = (date, pair) => tr('notifications.p0_pair_para_start', { p0: dayLabel(date), pair, start: pairs[pair].start });

  // 1. Объявления деканата.
  for (const a of q.announcements.all({ faculty: user.faculty, course: user.course, group: user.group_name })) {
    items.push({
      key: `announcement:${a.id}`,
      kind: 'announcement',
      kindLabel: tr('notifications.obyavlenie'),
      important: Boolean(a.important),
      title: a.title,
      body: preview(a.body),
      at: a.created_at,
      link: `/announcements/${a.id}`,
    });
  }

  // 2. Изменения в расписании группы (сегодня и дальше).
  const TITLES = { moved: tr('notifications.para_perenesena'), teacher_changed: tr('notifications.zamena_prepodavatelya'), room_changed: tr('notifications.drugaya_auditoriya'), cancelled: tr('notifications.para_otmenena') };
  for (const l of q.lessonChanges.all({ group: user.group_name, today })) {
    let body = `${l.discipline}, ${slot(l.date, l.pair)}`;
    if (l.status === 'moved') body = `${l.discipline}: ${slot(l.old_date, l.old_pair)} → ${slot(l.date, l.pair)}`;
    if (l.status === 'teacher_changed') body += tr('notifications.vedet_p0_vmesto_p1', { p0: shortName(l.teacher), p1: shortName(l.old_teacher) });
    if (l.status === 'room_changed') body += tr('notifications.auditoriya_room_vmesto_old', { room: l.room, old_room: l.old_room });
    if (l.change_note) body += `. ${l.change_note}`;
    items.push({
      key: `lesson:${l.id}:${l.changed_at}`,
      kind: 'schedule',
      kindLabel: tr('notifications.raspisanie'),
      important: false,
      title: TITLES[l.status],
      body,
      at: l.changed_at,
      link: `/week?start=${mondayOf(l.date)}#day-${l.date}`,
    });
  }

  // 3. Статусы заявок и ответы деканата (за последние 30 дней).
  const since = `${addDays(today, -HISTORY_DAYS)} 00:00`;
  const events = q.requestEvents.all({ id: user.id, since });
  const eventStamps = new Set(events.map((e) => `${e.request_id}|${e.actor_id}|${e.at}`));
  for (const e of events) {
    let body = T.statusHint(e.status, e);
    if (e.status === 'ready' && e.format === 'paper' && e.pickup_place) body = `${e.pickup_place}. ${e.pickup_hours || ''}`.trim();
    if (e.status === 'rejected' && e.reject_reason) body = tr('notifications.prichina_reject_reason', { reject_reason: e.reject_reason });
    if (e.note && e.status !== 'rejected') body = preview(e.note);
    items.push({
      key: `request_event:${e.id}`,
      kind: 'request',
      kindLabel: tr('notifications.zayavka'),
      important: false,
      title: `${requestTitle(e)}: ${T.statusLabel(e.status, e)}`,
      body,
      at: e.at,
      link: `/requests/${e.request_id}`,
    });
  }
  for (const m of q.staffMessages.all({ id: user.id, since })) {
    // Сообщение, отправленное вместе со сменой статуса, уже показано в уведомлении о статусе.
    if (eventStamps.has(`${m.request_id}|${m.author_id}|${m.created_at}`)) continue;
    items.push({
      key: `request_message:${m.id}`,
      kind: 'request',
      kindLabel: tr('notifications.zayavka'),
      important: false,
      title: tr('notifications.otvet_dekanata_p0', { p0: m.type === 'appeal' ? m.subject : requestTitle(m) }),
      body: preview(m.text),
      at: m.created_at,
      link: `/requests/${m.request_id}`,
    });
  }

  // Напоминание о приёме за день. В ключе дата и время: после переноса придёт новое.
  for (const a of appointmentReminders(user, today)) {
    items.push({
      key: `appointment:${a.id}:${a.date}:${a.time}`,
      kind: 'appointment',
      kindLabel: tr('notifications.priem'),
      important: false,
      title: tr('notifications.zavtra_priem_v_dekanate', { time: a.time }),
      body: `${a.topic} · ${a.place}`,
      at: `${today} 08:00`,
      link: '/appointments',
    });
  }

  // Надбавка: что решил деканат по записям студента.
  const BONUS_TITLES = { confirmed: tr('notifications.uchastie_podtverzhdeno'), awarded: tr('notifications.bally_nadbavki_nachisleny'), rejected: tr('notifications.zayavka_na_aktivnost_otklonena') };
  for (const e of bonusEvents(user.id, today, HISTORY_DAYS)) {
    items.push({
      key: `bonus:${e.id}:${e.status}`,
      kind: 'bonus',
      kindLabel: tr('notifications.nadbavka'),
      important: false,
      title: e.status === 'awarded' ? `${BONUS_TITLES.awarded}: +${e.points}` : BONUS_TITLES[e.status],
      body: e.title,
      at: e.updated_at,
      link: '/grades/bonus',
    });
  }

  // 4. Напоминания о дедлайнах, которые должен выполнить сам студент (за 7 дней).
  for (const d of deadlines(user, today)) {
    if (!d.own || d.daysLeft > REMIND_DAYS) continue;
    const when = d.daysLeft === 0 ? tr('notifications.segodnya') : d.daysLeft === 1 ? tr('notifications.zavtra') : tr('notifications.cherez_daysleft_p1', { daysLeft: d.daysLeft, p1: d.daysLeft < 5 ? tr('notifications.dnya') : tr('notifications.dney') });
    items.push({
      key: `deadline:${d.key}:${d.date}`,
      kind: 'deadline',
      kindLabel: tr('notifications.dedlayn'),
      important: d.daysLeft <= 1,
      title: `${when} — ${d.title}`,
      body: tr('notifications.srok_p0', { p0: fmt(d.date, { day: 'numeric', month: 'long' }) }),
      at: `${addDays(d.date, -REMIND_DAYS) > today ? today : addDays(d.date, -REMIND_DAYS)} 09:00`,
      link: d.link,
    });
  }

  // Прочитано / нет и порядок: непрочитанные важные сверху, остальное — от новых к старым.
  const read = new Set(q.reads.all(user.id).map((r) => r.item_key));
  for (const i of items) i.read = read.has(i.key);
  items.sort((a, b) => {
    const pa = a.important && !a.read ? 0 : 1;
    const pb = b.important && !b.read ? 0 : 1;
    return pa - pb || b.at.localeCompare(a.at);
  });
  return items;
}

function unreadCount(user, today) {
  return feed(user, today).filter((i) => !i.read).length;
}

// Отметить прочитанным — только ключи из СВОЕЙ ленты; чужие и выдуманные игнорируются.
function markRead(user, today, keys) {
  const own = new Set(feed(user, today).map((i) => i.key));
  const at = nowStamp();
  let n = 0;
  db.transaction(() => {
    for (const k of keys) {
      if (own.has(k)) n += q.markRead.run(user.id, k, at).changes;
    }
  })();
  return n;
}

function markAnnouncementRead(userId, id) {
  q.markRead.run(userId, `announcement:${id}`, nowStamp());
}

module.exports = { feed, deadlines, unreadCount, markRead, markAnnouncementRead, audienceMatches };
