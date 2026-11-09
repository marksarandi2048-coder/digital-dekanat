'use strict';
const { tr } = require('../i18n');
// Заявки и справки.
const express = require('express');
const QRCode = require('qrcode');
const { requireAuth } = require('../access');
const R = require('../requests');
const T = require('../requestTypes');
const { nowInMoscow } = require('../dates');

const router = express.Router();
router.use('/requests', requireAuth);
router.use('/request-types', requireAuth);

const STATUSES = ['accepted', 'in_progress', 'ready', 'issued', 'answered', 'rejected'];

// ---------- Проверка прав ----------
// Студент — только СВОЮ заявку; сотрудник — любую.
// На чужую и на несуществующую заявку ответ одинаковый — «не найдена»,
// чтобы перебором номеров нельзя было узнать, какие заявки существуют.
function loadAllowed(req, res) {
  const id = Number(req.params.id);
  const r = Number.isSafeInteger(id) && id > 0 ? R.getRequest(id) : undefined;
  if (!r || (req.user.role !== 'staff' && r.student_id !== req.user.id)) {
    res.status(404).json({ error: tr('requests.zayavka_ne_naydena') });
    return null;
  }
  return r;
}

function staffOnly(req, res, next) {
  if (req.user.role !== 'staff') return res.status(403).json({ error: tr('requests.tolko_dlya_sotrudnikov_dekanata') });
  next();
}

// Строка из запроса: обрезаем пробелы, проверяем длину.
function text(value, max) {
  if (typeof value !== 'string') return '';
  const t = value.trim();
  return t.length > max ? null : t;
}

// ---------- Справочник для формы ----------
router.get('/request-types', (req, res) => {
  res.json({ types: T.publicTypes(), purposeHints: T.purposeHints(), orderHints: T.orderHints(), maxCopies: T.MAX_COPIES });
});

// ---------- Список ----------
router.get('/requests', (req, res) => {
  if (req.user.role === 'staff') {
    const status = STATUSES.includes(req.query.status) ? req.query.status : null;
    return res.json({ role: 'staff', status, counts: R.statusCounts(), requests: R.listAll(status).map(R.toListItem) });
  }
  res.json({ role: 'student', requests: R.listForStudent(req.user.id).map(R.toListItem) });
});

// ---------- Новая заявка (только студент) ----------
router.post('/requests', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: tr('requests.zayavki_podayut_studenty') });
  const b = req.body || {};
  const type = T.TYPES[b.type] ? b.type : null;
  if (!type) return res.status(400).json({ error: tr('requests.vyberite_tip_zayavki') });
  const def = T.TYPES[type];

  const data = { type, format: null, purpose: null, order_ref: null, copies: null, subject: null, comment: null };

  if (def.kind === 'appeal') {
    const subject = text(b.subject, 200);
    const comment = text(b.comment, 2000);
    if (subject === null || comment === null) return res.status(400).json({ error: tr('requests.slishkom_dlinnyy_tekst') });
    if (!subject) return res.status(400).json({ error: tr('requests.ukazhite_temu_obrascheniya') });
    if (!comment) return res.status(400).json({ error: tr('requests.napishite_v_chem_vopros') });
    Object.assign(data, { subject, comment });
  } else {
    data.format = def.electronic && b.format === 'electronic' ? 'electronic' : 'paper';
    const purpose = text(b.purpose, 200);
    const comment = text(b.comment, 1000);
    if (purpose === null || comment === null) return res.status(400).json({ error: tr('requests.slishkom_dlinnyy_tekst') });
    if (!purpose) return res.status(400).json({ error: tr('requests.ukazhite_dlya_chego_ili') });
    data.purpose = purpose;
    data.comment = comment || null;
    if (def.needsOrder) {
      const orderRef = text(b.orderRef, 200);
      if (!orderRef) return res.status(400).json({ error: tr('requests.ukazhite_vypiska_iz_kakogo') });
      data.order_ref = orderRef;
    }
    if (data.format === 'paper') {
      const copies = Number(b.copies);
      if (!Number.isInteger(copies) || copies < 1 || copies > T.MAX_COPIES) {
        return res.status(400).json({ error: tr('requests.kolichestvo_ekzemplyarov_ot_1', { MAX_COPIES: T.MAX_COPIES }) });
      }
      data.copies = copies;
    }
  }

  const id = R.createRequest(req.user, data);
  res.status(201).json({ id });
});

// ---------- Одна заявка ----------
router.get('/requests/:id', (req, res) => {
  const r = loadAllowed(req, res);
  if (!r) return;
  res.json({ request: R.toDetail(r, req.user, nowInMoscow().date) });
});

// QR-код электронной справки (картинка).
router.get('/requests/:id/qr.svg', async (req, res, next) => {
  const r = loadAllowed(req, res);
  if (!r) return;
  const cert = R.certificateForRequest(r.id);
  if (!cert) return res.status(404).json({ error: tr('requests.spravka_esche_ne_gotova') });
  try {
    const detail = R.toDetail(r, req.user, nowInMoscow().date);
    const svg = await QRCode.toString(detail.certificate.verifyUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    res.type('image/svg+xml').send(svg);
  } catch (err) {
    next(err);
  }
});

// ---------- Переписка ----------
router.post('/requests/:id/messages', (req, res) => {
  const r = loadAllowed(req, res);
  if (!r) return;
  const msg = text((req.body || {}).text, 2000);
  if (msg === null) return res.status(400).json({ error: tr('requests.soobschenie_slishkom_dlinnoe_do') });
  if (!msg) return res.status(400).json({ error: tr('requests.napishite_soobschenie') });
  R.addMessage(r.id, req.user.id, msg);
  res.status(201).json({ ok: true });
});

// ---------- Смена статуса (только сотрудник) ----------
router.post('/requests/:id/status', staffOnly, (req, res) => {
  const r = loadAllowed(req, res);
  if (!r) return;
  const b = req.body || {};
  const status = b.status;

  const note = text(b.note, 2000);
  const reason = text(b.reason, 500);
  const pickupPlace = text(b.pickupPlace, 200);
  const pickupHours = text(b.pickupHours, 200);
  if ([note, reason, pickupPlace, pickupHours].includes(null)) {
    return res.status(400).json({ error: tr('requests.slishkom_dlinnyy_tekst') });
  }

  if (status === 'rejected') {
    if (!T.canReject(r)) return res.status(409).json({ error: tr('requests.etu_zayavku_uzhe_nelzya') });
    if (!reason) return res.status(400).json({ error: tr('requests.ukazhite_prichinu_otkaza') });
    R.changeStatus(r, req.user, { status, rejectReason: reason });
    return res.json({ ok: true });
  }

  // Только следующий шаг по цепочке: перескочить или вернуться назад нельзя.
  if (status !== T.nextStatus(r)) {
    return res.status(409).json({ error: tr('requests.status_mozhno_menyat_tolko') });
  }
  if (status === 'answered' && !note) return res.status(400).json({ error: tr('requests.napishite_otvet_studentu') });

  let place = null;
  let hours = null;
  if (status === 'ready' && r.format === 'paper') {
    const defaults = T.pickupFor(r.student_faculty);
    place = pickupPlace || defaults.place;
    hours = pickupHours || defaults.hours;
  }
  R.changeStatus(r, req.user, { status, note: note || null, pickupPlace: place, pickupHours: hours });
  res.json({ ok: true });
});

module.exports = router;
