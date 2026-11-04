'use strict';
// Вход и выход.
const express = require('express');
const bcrypt = require('bcrypt');
const { findByLogin, toProfile } = require('../users');

const router = express.Router();

// Если логина нет, всё равно сверяем пароль с «пустым» хешем — так по времени
// ответа нельзя угадать, существует ли логин.
const DUMMY_HASH = bcrypt.hashSync('no-such-user-placeholder', 10);

// Простая защита от подбора пароля: не больше 10 неудачных попыток
// с одного адреса за 15 минут.
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map(); // ip -> { count, until }

function isBlocked(ip) {
  const entry = fails.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    fails.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILS;
}

function registerFail(ip) {
  const now = Date.now();
  const entry = fails.get(ip);
  if (!entry || now > entry.until) fails.set(ip, { count: 1, until: now + WINDOW_MS });
  else entry.count += 1;
}

router.post('/login', async (req, res, next) => {
  const ip = req.ip;
  if (isBlocked(ip)) {
    return res.status(429).json({ error: 'Слишком много попыток. Подождите 15 минут.' });
  }

  const body = req.body || {};
  const login = typeof body.login === 'string' ? body.login.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!login || !password || login.length > 100 || password.length > 200) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }

  const user = findByLogin(login);
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    registerFail(ip);
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  fails.delete(ip);
  // Новая сессия при входе — защита от подмены сессии.
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user.id;
    req.session.save((err2) => {
      if (err2) return next(err2);
      res.json({ user: toProfile(user) });
    });
  });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(req.app.get('sessionCookieName'));
    res.json({ ok: true });
  });
});

module.exports = router;
