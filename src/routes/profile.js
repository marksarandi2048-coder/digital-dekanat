'use strict';
// Профили пользователей.
const express = require('express');
const { requireAuth, canViewProfile } = require('../access');
const { findById, toProfile } = require('../users');

const router = express.Router();
router.use(requireAuth);

// Мой профиль.
router.get('/me', (req, res) => {
  res.json({ user: toProfile(req.user) });
});

// Профиль по id — с проверкой прав.
router.get('/users/:id/profile', (req, res) => {
  const id = Number(req.params.id);
  const target = Number.isSafeInteger(id) && id > 0 ? findById(id) : undefined;

  if (target && canViewProfile(req.user, target)) {
    return res.json({ user: toProfile(target) });
  }
  // Студенту одинаково отвечаем «нет доступа» и на чужой, и на несуществующий id,
  // чтобы нельзя было перебором узнать, какие id заняты.
  if (!target && req.user.role === 'staff') {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  return res.status(403).json({ error: 'Нет доступа к этому профилю' });
});

module.exports = router;
