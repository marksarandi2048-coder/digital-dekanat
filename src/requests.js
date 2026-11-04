'use strict';
// Заявки: чтение, создание, смена статуса, переписка, электронные справки.
// Проверка ПРАВ — в маршрутах (src/routes/requests.js); здесь только работа с данными.
const crypto = require('node:crypto');
const { db } = require('./db');
const { nowStamp, addDays, nowInMoscow } = require('./dates');
const { PUBLIC_URL } = require('./config');
const T = require('./requestTypes');

const STUDY_FORM = 'очная';

const q = {
  byId: db.prepare(`
    SELECT r.*, c.valid_until AS cert_valid_until, c.revoked_at AS cert_revoked_at, u.full_name AS student_name, u.group_name AS student_group, u.faculty AS student_faculty
    FROM requests r JOIN users u ON u.id = r.student_id
    LEFT JOIN e_certificates c ON c.request_id = r.id
    WHERE r.id = ?`),
  byStudent: db.prepare(`
    SELECT r.*, c.valid_until AS cert_valid_until, c.revoked_at AS cert_revoked_at, u.full_name AS student_name, u.group_name AS student_group
    FROM requests r JOIN users u ON u.id = r.student_id
    LEFT JOIN e_certificates c ON c.request_id = r.id
    WHERE r.student_id = ? ORDER BY r.created_at DESC, r.id DESC`),
  all: db.prepare(`
    SELECT r.*, c.valid_until AS cert_valid_until, c.revoked_at AS cert_revoked_at, u.full_name AS student_name, u.group_name AS student_group
    FROM requests r JOIN users u ON u.id = r.student_id
    LEFT JOIN e_certificates c ON c.request_id = r.id
    ORDER BY r.created_at DESC, r.id DESC`),
  byStatus: db.prepare(`
    SELECT r.*, c.valid_until AS cert_valid_until, c.revoked_at AS cert_revoked_at, u.full_name AS student_name, u.group_name AS student_group
    FROM requests r JOIN users u ON u.id = r.student_id
    LEFT JOIN e_certificates c ON c.request_id = r.id
    WHERE r.status = ? ORDER BY r.created_at DESC, r.id DESC`),
  counts: db.prepare('SELECT status, COUNT(*) AS n FROM requests GROUP BY status'),
  events: db.prepare('SELECT status, at, note FROM request_events WHERE request_id = ? ORDER BY at, id'),
  messages: db.prepare(`
    SELECT m.id, m.text, m.created_at, u.full_name AS author_name, u.role AS author_role, m.author_id
    FROM request_messages m JOIN users u ON u.id = m.author_id
    WHERE m.request_id = ? ORDER BY m.created_at, m.id`),
  insertRequest: db.prepare(`
    INSERT INTO requests (student_id, type, format, purpose, order_ref, copies, subject, comment, status, created_at, updated_at)
    VALUES (@student_id, @type, @format, @purpose, @order_ref, @copies, @subject, @comment, 'accepted', @at, @at)`),
  insertEvent: db.prepare('INSERT INTO request_events (request_id, status, at, actor_id, note) VALUES (?, ?, ?, ?, ?)'),
  insertMessage: db.prepare('INSERT INTO request_messages (request_id, author_id, text, created_at) VALUES (?, ?, ?, ?)'),
  updateStatus: db.prepare(`
    UPDATE requests SET status = @status, updated_at = @at,
      reject_reason = COALESCE(@reject_reason, reject_reason),
      pickup_place = COALESCE(@pickup_place, pickup_place),
      pickup_hours = COALESCE(@pickup_hours, pickup_hours)
    WHERE id = @id`),
  touch: db.prepare('UPDATE requests SET updated_at = ? WHERE id = ?'),
  certByRequest: db.prepare('SELECT * FROM e_certificates WHERE request_id = ?'),
  certByCode: db.prepare('SELECT * FROM e_certificates WHERE code = ?'),
  insertCert: db.prepare(`
    INSERT INTO e_certificates (request_id, code, number, full_name, faculty, program, course, study_form, purpose, issued_at, valid_until, signed_by)
    VALUES (@request_id, @code, @number, @full_name, @faculty, @program, @course, @study_form, @purpose, @issued_at, @valid_until, @signed_by)`),
  user: db.prepare('SELECT * FROM users WHERE id = ?'),
};

// ---------- Чтение ----------
const getRequest = (id) => q.byId.get(id);
const listForStudent = (studentId) => q.byStudent.all(studentId);
const listAll = (status) => (status ? q.byStatus.all(status) : q.all.all());
const statusCounts = () => Object.fromEntries(q.counts.all().map((r) => [r.status, r.n]));

// «Трекер как у доставки»: шаги цепочки с датами.
function tracker(req) {
  const at = {};
  for (const e of q.events.all(req.id)) at[e.status] = e.at;
  const chain = T.chainFor(req);
  let steps = chain.map((status) => ({
    status,
    label: T.statusLabel(status, req),
    hint: T.statusHint(status, req),
    at: at[status] || null,
    done: Boolean(at[status]),
  }));
  if (req.status === 'rejected') {
    steps = steps.filter((s) => s.done);
    steps.push({ status: 'rejected', label: T.statusLabel('rejected', req), hint: T.statusHint('rejected', req), at: at.rejected || null, done: true });
  }
  return steps;
}

const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);

function shortName(fullName) {
  const [last, ...rest] = fullName.split(/\s+/);
  return [last, ...rest.map((p) => `${p[0]}.`)].join(' ');
}

// Что показать на значке статуса. Готовая электронная справка с истёкшим
// сроком или отозванная — не «Готова», а «Срок истёк» / «Отозвана».
function displayStatus(r) {
  if (r.status === 'ready' && r.format === 'electronic') {
    if (r.cert_revoked_at) return { statusLabel: 'Отозвана', statusClass: 'expired' };
    if (r.cert_valid_until && nowInMoscow().date > r.cert_valid_until) return { statusLabel: 'Срок истёк', statusClass: 'expired' };
  }
  return { statusLabel: T.statusLabel(r.status, r), statusClass: r.status };
}

// Краткая форма для списков.
function toListItem(r) {
  return {
    id: r.id,
    type: r.type,
    typeLabel: T.TYPES[r.type].label,
    format: r.format,
    title: r.type === 'appeal' ? r.subject : r.type === 'order_extract' ? `${T.TYPES[r.type].label}: ${r.order_ref}` : T.TYPES[r.type].label,
    purpose: r.purpose,
    status: r.status,
    ...displayStatus(r),
    closed: T.isClosed(r),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    student: { id: r.student_id, fullName: r.student_name, group: r.student_group },
  };
}

function certificateInfo(cert, today) {
  if (!cert) return null;
  return {
    number: cert.number,
    code: cert.code,
    verifyUrl: `${PUBLIC_URL}/verify/${cert.code}`,
    verifyBase: `${PUBLIC_URL}/verify`,
    fullName: cert.full_name,
    faculty: cert.faculty,
    program: cert.program,
    course: cert.course,
    studyForm: cert.study_form,
    purpose: cert.purpose,
    issuedAt: cert.issued_at,
    validUntil: cert.valid_until,
    signedBy: cert.signed_by,
    state: certState(cert, today),
  };
}

function certState(cert, today) {
  if (cert.revoked_at) return 'revoked';
  if (today > cert.valid_until) return 'expired';
  return 'valid';
}

// Полная форма для страницы заявки. viewer — кто смотрит (для подсказок, что ему можно).
function toDetail(r, viewer, today) {
  const next = T.nextStatus(r);
  return {
    ...toListItem(r),
    orderRef: r.order_ref,
    copies: r.copies,
    subject: r.subject,
    comment: r.comment,
    rejectReason: r.reject_reason,
    pickup: r.status === 'ready' && r.format === 'paper' ? { place: r.pickup_place, hours: r.pickup_hours } : null,
    steps: tracker(r),
    messages: q.messages.all(r.id).map((m) => ({
      id: m.id,
      text: m.text,
      createdAt: m.created_at,
      author: m.author_role === 'staff' ? `${shortName(m.author_name)}, деканат` : shortName(m.author_name),
      fromStaff: m.author_role === 'staff',
      mine: m.author_id === viewer.id,
    })),
    certificate: certificateInfo(q.certByRequest.get(r.id), today),
    // Действия сотрудника.
    actions:
      viewer.role === 'staff'
        ? {
            next: next ? { status: next, label: T.statusLabel(next, r) } : null,
            canReject: T.canReject(r),
            needsPickup: next === 'ready' && r.format === 'paper',
            needsAnswer: next === 'answered',
            pickupDefaults: T.pickupFor(r.student_faculty),
          }
        : null,
  };
}

// ---------- Создание и изменения ----------
function createRequest(student, data) {
  const at = nowStamp();
  return db.transaction(() => {
    const id = q.insertRequest.run({ student_id: student.id, at, ...data }).lastInsertRowid;
    q.insertEvent.run(id, 'accepted', at, student.id, null);
    return id;
  })();
}

function addMessage(requestId, authorId, text, at = nowStamp()) {
  q.insertMessage.run(requestId, authorId, text, at);
  q.touch.run(at, requestId);
}

// Выпуск электронной справки: случайный код, номер, снимок данных студента.
function issueCertificate(req, signer, issuedAt) {
  const student = q.user.get(req.student_id);
  const issuedDate = issuedAt.slice(0, 10);
  q.insertCert.run({
    request_id: req.id,
    code: crypto.randomBytes(16).toString('base64url'), // 128 бит, 22 символа
    number: `ЭС-${issuedDate.slice(0, 4)}-${String(req.id).padStart(6, '0')}`,
    full_name: student.full_name,
    faculty: student.faculty,
    program: student.program,
    course: student.course,
    study_form: STUDY_FORM,
    purpose: req.purpose,
    issued_at: issuedAt,
    valid_until: addDays(issuedDate, T.CERTIFICATE_DAYS),
    signed_by: `${shortName(signer.full_name)}, ${lowerFirst(signer.position || 'сотрудник деканата')}`,
  });
}

// Смена статуса сотрудником. Проверки допустимости — в маршруте.
function changeStatus(req, actor, { status, note, rejectReason, pickupPlace, pickupHours }, at = nowStamp()) {
  db.transaction(() => {
    q.updateStatus.run({
      id: req.id,
      status,
      at,
      reject_reason: status === 'rejected' ? rejectReason : null,
      pickup_place: status === 'ready' ? pickupPlace || null : null,
      pickup_hours: status === 'ready' ? pickupHours || null : null,
    });
    q.insertEvent.run(req.id, status, at, actor.id, status === 'rejected' ? rejectReason : note || null);
    if (note) q.insertMessage.run(req.id, actor.id, note, at);
    if (status === 'ready' && req.format === 'electronic' && req.type === 'study_certificate') {
      issueCertificate(req, actor, at);
    }
  })();
}

// ---------- Проверка подлинности (открытая) ----------
function verifyCode(code, today) {
  const cert = q.certByCode.get(code);
  if (!cert) return { state: 'not_found' };
  return {
    state: certState(cert, today),
    certificate: {
      number: cert.number,
      fullName: cert.full_name,
      faculty: cert.faculty,
      program: cert.program,
      course: cert.course,
      studyForm: cert.study_form,
      issuedAt: cert.issued_at,
      validUntil: cert.valid_until,
      signedBy: cert.signed_by,
    },
  };
}

const certificateForRequest = (requestId) => q.certByRequest.get(requestId);

module.exports = {
  getRequest,
  listForStudent,
  listAll,
  statusCounts,
  toListItem,
  toDetail,
  createRequest,
  addMessage,
  changeStatus,
  verifyCode,
  certificateForRequest,
};
