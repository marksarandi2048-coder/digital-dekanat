'use strict';
// Профили пользователей.
const express = require('express');
const { requireAuth, canViewProfile } = require('../access');
const { findById, toProfile } = require('../users');
const { db } = require('../db');
const { deanOffice } = require('../faculties');

const router = express.Router();

const curatorQuery = db.prepare('SELECT curator_name, curator_email FROM groups WHERE name = ?');

// «Полезное» в своём профиле: группа, куратор, контакты деканата своего факультета.
// Только для самого студента: в чужом профиле и в профиле сотрудника этого блока нет.
function usefulFor(user) {
  if (user.role !== 'student') return null;
  const dean = deanOffice(user.faculty);
  const g = user.group_name ? curatorQuery.get(user.group_name) : null;
  return {
    group: user.group_name || null,
    curator: g && g.curator_name ? { name: g.curator_name, email: g.curator_email } : null,
    dean: { office: dean.office, hours: dean.hours, phone: dean.phone, email: dean.email },
  };
}

// Мой профиль.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toProfile(req.user), useful: usefulFor(req.user) });
});

// Профиль по id — с проверкой прав.
router.get('/users/:id/profile', requireAuth, (req, res) => {
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
