'use strict';
// Открытая проверка подлинности электронной справки по коду из QR.
// Вход не нужен. Показывает только то, что и так напечатано в справке.
const express = require('express');
const { verifyCode } = require('../requests');
const { nowInMoscow } = require('../dates');

const router = express.Router();

// Не больше 60 проверок с одного адреса за 10 минут — защита от перебора кодов.
const LIMIT = 60;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();

function tooMany(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.until) {
    hits.set(ip, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

router.get('/verify/:code', (req, res) => {
  if (tooMany(req.ip)) return res.status(429).json({ error: 'Слишком много проверок. Попробуйте через 10 минут.' });
  const code = req.params.code;
  // Код — 22 символа из латиницы, цифр, «-» и «_». Иное — сразу «не найдена».
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) return res.json({ state: 'not_found' });
  res.json(verifyCode(code, nowInMoscow().date));
});

module.exports = router;
