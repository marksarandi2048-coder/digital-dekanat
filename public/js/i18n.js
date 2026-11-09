'use strict';
// Язык интерфейса. Подключается в <head> сразу после словарей.
// Выбор хранится в cookie браузера: так его знает и сервер. Это не личные данные.
(function () {
  const COOKIE = 'dekanat-lang';
  const LANGS = { ru: 'Русский', en: 'English' };
  const OFFLINE_SYNC_KEY = 'dekanat-offline-sync';

  function readLang() {
    const found = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(ru|en)`));
    return found ? found[1] : 'ru';
  }

  const lang = readLang();
  const dict = window.DEKANAT_DICT;

  // Перевод по ключу: tr('home.title', { name: 'Анна' }) подставляет {name}.
  function tr(key, params) {
    const text = dict[lang][key] ?? dict.ru[key] ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (all, name) => (name in params ? String(params[name]) : all));
  }

  function setLang(next) {
    if (!LANGS[next] || next === lang) return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    try {
      window.localStorage.removeItem(OFFLINE_SYNC_KEY); // сохранённые неделя и билет обновятся на новом языке
    } catch {
      // хранилище запрещено — обновятся по расписанию
    }
    window.location.reload();
  }

  function buildSwitch(box) {
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', tr('lang.switch_label'));
    box.classList.add('lang-switch');
    for (const [code, name] of Object.entries(LANGS)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lang-switch__button';
      button.lang = code;
      button.textContent = name;
      button.setAttribute('aria-pressed', String(code === lang));
      button.addEventListener('click', () => setLang(code));
      box.append(button);
    }
  }

  // Подставляем тексты в разметку, пока браузер её читает: страница сразу на нужном языке.
  const done = new WeakSet();

  function applyTo(node) {
    if (done.has(node)) return;
    done.add(node);
    const key = node.getAttribute('data-i18n');
    if (key) node.textContent = tr(key);
    const attrs = node.getAttribute('data-i18n-attr');
    if (attrs) {
      for (const pair of attrs.split(',')) {
        const [name, attrKey] = pair.split('=');
        node.setAttribute(name, tr(attrKey));
      }
    }
    if (node.hasAttribute('data-lang-switch')) buildSwitch(node);
  }

  const SELECTOR = '[data-i18n],[data-i18n-attr],[data-lang-switch]';

  function applyWithin(root) {
    if (root.matches && root.matches(SELECTOR)) applyTo(root);
    if (root.querySelectorAll) root.querySelectorAll(SELECTOR).forEach(applyTo);
  }

  document.documentElement.lang = lang;
  if (lang === 'en') {
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.href = '/manifest.en.webmanifest';
    const appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appTitle) appTitle.content = "Dean's Office";
  }

  applyWithin(document);
  const observer = new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach((node) => node.nodeType === 1 && applyWithin(node));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => {
    observer.takeRecords();
    observer.disconnect();
    applyWithin(document);
  });

  window.tr = tr;
  window.DekanatI18n = { lang, locale: lang === 'en' ? 'en-US' : 'ru-RU', setLang };
})();
