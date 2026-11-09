'use strict';
// Студенческий билет. Чей билет — определяется только по сессии, номера в адресе нет.
const express = require('express');
const QRCode = require('qrcode');
const { requireAuth } = require('../access');
const { cardFor, checkUrlFor } = require('../studentCard');
const { nowInMoscow } = require('../dates');

const router = express.Router();
router.use('/student-card', requireAuth);

router.get('/student-card', (req, res) => {
  if (req.user.role !== 'student') return res.json({ card: null });
  res.json({ card: cardFor(req.user, nowInMoscow().date) });
});

router.get('/student-card/qr.svg', async (req, res, next) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Билет есть только у студентов' });
  try {
    const url = checkUrlFor(req.user, nowInMoscow().date);
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    res.type('image/svg+xml').send(svg);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
