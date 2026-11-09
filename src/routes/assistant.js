'use strict';
// ИИ-помощник. Только для вошедшего студента: кто спрашивает, определяется по сессии.
// Переписка лежит только в сессии: в базу и на устройство она не записывается.
const express = require('express');
const { tr } = require('../i18n');
const { requireAuth } = require('../access');
const { isConfigured } = require('../gigachat');
const A = require('../assistant');

const router = express.Router();

router.use('/assistant', requireAuth, (req, res, next) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: tr('assistant.error.students_only') });
  next();
});

const history = (req) => req.session.assistant || [];

router.get('/assistant', (req, res) => {
  res.json({ available: isConfigured(), questionMax: A.QUESTION_MAX, messages: history(req) });
});

router.post('/assistant/messages', async (req, res) => {
  const { question, error } = A.validateQuestion(req.body && req.body.question);
  if (error) return res.status(400).json({ error: tr(error) });

  const userId = req.user.id;
  if (A.inFlight.has(userId)) return res.status(429).json({ error: tr('assistant.error.in_progress') });
  const limited = A.checkLimit(userId);
  if (limited) return res.status(429).json({ error: tr(limited) });

  A.inFlight.add(userId);
  let reply;
  try {
    reply = await A.ask(req.user, question, history(req));
  } catch (err) {
    console.error('Помощник:', err.message); // причина без текста вопроса и без ключей
    const { status, key } = A.publicError(err);
    return res.status(status).json({ error: tr(key) });
  } finally {
    A.inFlight.delete(userId);
  }

  // Пока модель думала, студент мог выйти. Без этой проверки закрытый вход записался бы заново.
  req.session.reload((err) => {
    if (err) return res.status(401).json({ error: tr('access.nuzhno_voyti_v_sistemu') });
    req.session.assistant = [
      ...history(req),
      { role: 'user', text: question },
      { role: 'assistant', text: reply.answer, actions: reply.actions },
    ].slice(-A.HISTORY_KEEP);
    res.json(reply);
  });
});

router.delete('/assistant/messages', (req, res) => {
  delete req.session.assistant;
  res.json({ ok: true });
});

module.exports = router;
