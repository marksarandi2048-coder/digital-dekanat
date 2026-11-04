'use strict';
// Проверка прав. Все решения «можно / нельзя» принимаются здесь, на сервере.
const { findById } = require('./users');

// Пускает дальше только вошедшего пользователя и кладёт его в req.user.
// Пользователь каждый раз читается из базы: если его удалили, сессия перестаёт работать.
function requireAuth(req, res, next) {
  const user = req.session.userId ? findById(req.session.userId) : undefined;
  if (!user) {
    return req.session.destroy(() => {
      res.status(401).json({ error: 'Нужно войти в систему' });
    });
  }
  req.user = user;
  next();
}

// Чей профиль можно смотреть:
//  - свой — всегда;
//  - сотрудник деканата — профили студентов (но не других сотрудников);
//  - студент — только свой.
function canViewProfile(viewer, target) {
  if (viewer.id === target.id) return true;
  return viewer.role === 'staff' && target.role === 'student';
}

module.exports = { requireAuth, canViewProfile };
