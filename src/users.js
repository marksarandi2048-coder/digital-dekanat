'use strict';
// Работа с таблицей пользователей. Все запросы — с параметрами.
const { db } = require('./db');

const byLogin = db.prepare('SELECT * FROM users WHERE login = ?');
const byId = db.prepare('SELECT * FROM users WHERE id = ?');

function findByLogin(login) {
  return byLogin.get(login);
}

function findById(id) {
  return byId.get(id);
}

// То, что можно отдавать в браузер. Хеш пароля и логин сюда не попадают.
function toProfile(user) {
  const profile = {
    id: user.id,
    role: user.role,
    fullName: user.full_name,
    faculty: user.faculty,
  };
  if (user.role === 'student') {
    profile.program = user.program;
    profile.course = user.course;
    profile.group = user.group_name;
  } else {
    profile.position = user.position;
  }
  return profile;
}

module.exports = { findByLogin, findById, toProfile };
