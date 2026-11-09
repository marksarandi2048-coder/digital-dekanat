'use strict';
// Цифровой студенческий билет (концепт, не является документом).
// Билет создаётся сам при первом открытии. Код для QR — случайный, по нему
// нельзя узнать ни студента, ни номер билета.
const crypto = require('node:crypto');
const { db } = require('./db');
const { PUBLIC_URL } = require('./config');
const { initials } = require('./users');

const q = {
  byUser: db.prepare('SELECT * FROM student_cards WHERE user_id = ?'),
  byCode: db.prepare('SELECT valid_until FROM student_cards WHERE code = ?'),
  insert: db.prepare(`
    INSERT INTO student_cards (user_id, code, number, issued_on, valid_until)
    VALUES (@user_id, @code, @number, @issued_on, @valid_until)
  `),
  renew: db.prepare('UPDATE student_cards SET valid_until = ? WHERE id = ?'),
};

// 31 августа текущего учебного года (учебный год начинается 1 сентября).
function academicYearEnd(today) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return `${month >= 9 ? year + 1 : year}-08-31`;
}

// Билет студента: создаёт при первом открытии, в новом учебном году продлевает.
function ensureCard(user, today) {
  const existing = q.byUser.get(user.id);
  const validUntil = academicYearEnd(today);
  if (!existing) {
    q.insert.run({
      user_id: user.id,
      code: crypto.randomBytes(16).toString('base64url'), // 128 бит, 22 символа
      number: `СБ-${today.slice(0, 4)}-${String(user.id).padStart(5, '0')}`,
      issued_on: today,
      valid_until: validUntil,
    });
    return q.byUser.get(user.id);
  }
  if (existing.valid_until < today) {
    q.renew.run(validUntil, existing.id);
    return { ...existing, valid_until: validUntil };
  }
  return existing;
}

// То, что видит сам студент. Секретный код в браузер не отдаётся: QR приходит картинкой.
function cardFor(user, today) {
  const row = ensureCard(user, today);
  return {
    fullName: user.full_name,
    initials: initials(user.full_name),
    faculty: user.faculty,
    course: user.course,
    group: user.group_name,
    number: row.number,
    validUntil: row.valid_until,
  };
}

// Адрес открытой проверки: без сайта — для кнопки «Проверить мой билет», с сайтом — для QR.
function checkPathFor(user, today) {
  return `/check/${ensureCard(user, today).code}`;
}

function checkUrlFor(user, today) {
  return `${PUBLIC_URL}${checkPathFor(user, today)}`;
}

// Открытая проверка: только статус и срок, никаких данных о студенте.
function checkCode(code, today) {
  const row = q.byCode.get(code);
  if (!row) return { state: 'not_found' };
  return { state: row.valid_until >= today ? 'valid' : 'expired', validUntil: row.valid_until };
}

module.exports = { cardFor, checkPathFor, checkUrlFor, checkCode };
