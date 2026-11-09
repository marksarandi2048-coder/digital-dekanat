'use strict';
// «Спроси деканат». Открыт без входа: здесь нет личных данных, а вопрос о пароле задают
// как раз те, кто войти не может. Запросы нигде не сохраняются.
const express = require('express');
const { search, popular } = require('../faqSearch');

const router = express.Router();
const QUERY_MAX = 200;

router.get('/help', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, QUERY_MAX) : '';
  if (!q.trim()) return res.json({ popular: popular() });
  res.json({ results: search(q) });
});

module.exports = router;
