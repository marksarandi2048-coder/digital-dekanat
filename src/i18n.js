'use strict';
// Язык на сервере: словари те же, что у браузера (public/i18n).
// Язык запроса запоминается на время его обработки, поэтому его не нужно передавать через все функции.
// Вне запроса (заполнение базы) — русский.
const { AsyncLocalStorage } = require('node:async_hooks');
const ru = require('../public/i18n/ru');
const en = require('../public/i18n/en');

const dicts = { ru, en };
const storage = new AsyncLocalStorage();

const currentLang = () => storage.getStore() || 'ru';
const currentLocale = () => (currentLang() === 'en' ? 'en-US' : 'ru-RU');

function tr(key, params) {
  const text = dicts[currentLang()][key] ?? ru[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (all, name) => (name in params ? String(params[name]) : all));
}

// Подключается после разбора тела запроса и сессии.
function languageMiddleware(req, res, next) {
  const found = (req.headers.cookie || '').match(/(?:^|; )dekanat-lang=(ru|en)/);
  storage.run(found ? found[1] : 'ru', next);
}

module.exports = { tr, currentLang, currentLocale, languageMiddleware };
