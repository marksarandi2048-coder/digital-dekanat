'use strict';
// Приложение на телефоне: подключение сервис-воркера и очистка личных данных при выходе.
// Подключается в <head> до содержимого страницы.
window.DekanatPwa = (function () {
  const PERSONAL_CACHE = 'dekanat-personal';
  // Выход нажат: 'pending' — сервер ещё не знает (не было сети), 'done' — всё закрыто.
  const LOGOUT_KEY = 'dekanat-logout';

  function store(action, key, value) {
    try {
      if (action === 'get') return window.localStorage.getItem(key);
      if (action === 'set') window.localStorage.setItem(key, value);
      if (action === 'remove') window.localStorage.removeItem(key);
    } catch {
      // хранилище запрещено — обойдёмся без него
    }
    return null;
  }

  // Что держим наготове для работы без сети, даже если студент это ещё не открывал.
  const OFFLINE_URLS = ['/api/schedule/week', '/api/student-card', '/api/student-card/qr.svg'];
  const SYNC_KEY = 'dekanat-offline-sync';
  const SYNC_EVERY_MS = 15 * 60 * 1000;
  let currentRole = null;

  // Просим сервис-воркер стереть личные данные и ждём ответа (не дольше секунды).
  function askWorkerToWipe() {
    const worker = 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null;
    if (!worker) return Promise.resolve();
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = resolve;
      worker.postMessage({ type: 'wipe' }, [channel.port2]);
      setTimeout(resolve, 1000);
    });
  }

  async function wipe() {
    store('remove', SYNC_KEY);
    await askWorkerToWipe();
    if ('caches' in window) await window.caches.delete(PERSONAL_CACHE).catch(() => {});
  }

  async function tellServerLogout() {
    const res = await fetch('/api/logout', { method: 'POST' });
    if (res.ok) store('set', LOGOUT_KEY, 'done');
    return res.ok;
  }

  // «Выйти»: личные данные стираются сразу, даже без сети. Если сервер сейчас недоступен,
  // отметка 'pending' закроет вход на сервере при первом же подключении.
  async function signOut() {
    store('set', LOGOUT_KEY, 'pending');
    await wipe();
    try {
      await tellServerLogout();
      await wipe(); // на случай запроса, завершившегося между двумя шагами
    } catch {
      // нет сети — закончим при подключении
    }
  }

  async function finishPendingLogout() {
    if (store('get', LOGOUT_KEY) !== 'pending') return;
    try {
      if (await tellServerLogout()) {
        await wipe();
        if (window.location.pathname !== '/') {
          window.location.replace('/');
          return;
        }
      }
    } catch {
      // сети всё ещё нет
    }
    document.documentElement.style.visibility = '';
  }

  // Ждём, пока сервис-воркер начнёт обслуживать страницу (при самом первом открытии — не сразу).
  async function controllingWorker() {
    if (!('serviceWorker' in navigator)) return null;
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      setTimeout(resolve, 3000);
    });
    return navigator.serviceWorker.controller;
  }

  // Сервер подтвердил, что вход действует: без сети кабинет откроется, а не форма входа.
  async function sessionConfirmed(role) {
    currentRole = role;
    if (store('get', LOGOUT_KEY)) return;
    const worker = await controllingWorker();
    if (worker && !store('get', LOGOUT_KEY)) {
      worker.postMessage({ type: 'signed-in' });
      refreshOfflineData();
    }
  }

  // Тихо обновляет неделю и билет. Только у студента: у сотрудника офлайн-данных нет.
  async function refreshOfflineData() {
    if (currentRole !== 'student' || store('get', LOGOUT_KEY)) return;
    if (Date.now() - Number(store('get', SYNC_KEY) || 0) < SYNC_EVERY_MS) return;
    if (!navigator.serviceWorker.controller) return;
    store('set', SYNC_KEY, String(Date.now()));
    try {
      await Promise.all(OFFLINE_URLS.map((url) => fetch(url)));
    } catch {
      store('remove', SYNC_KEY); // сети нет — попробуем в следующий раз
    }
  }

  // Приложение вернули на экран после перерыва.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshOfflineData();
  });

  // Новый вход: всё, что могло остаться от прежней сессии, убираем.
  async function signedIn() {
    await wipe();
    store('remove', LOGOUT_KEY);
  }

  if (store('get', LOGOUT_KEY) === 'pending' && window.location.pathname !== '/') {
    // Вход на сервере ещё открыт, а студент уже вышел: кабинет не показываем.
    document.documentElement.style.visibility = 'hidden';
  }
  finishPendingLogout();
  window.addEventListener('online', finishPendingLogout);

  // Кнопка «Назад» после выхода не должна возвращать страницу из памяти браузера.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && store('get', LOGOUT_KEY) && window.location.pathname !== '/') {
      window.location.replace('/');
    }
  });

  // ---------- Подсказка «Установите кабинет как приложение» ----------
  const HINT_HIDDEN_KEY = 'dekanat-install-hint-hidden'; // настройка устройства, не личные данные
  const SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  let installPrompt = null; // браузер разрешил показать своё окно установки
  const hintSlots = new Map(); // блок на странице → роль пользователя

  const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function make(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function hintDescription(role) {
    const box = make('p', 'install-hint__text');
    if (isIos()) {
      const share = make('span', 'install-hint__share');
      share.innerHTML = SHARE_ICON; // наша постоянная иконка, не данные пользователя
      box.append('Нажмите ', share, ' «Поделиться» → «На экран Домой»');
    } else {
      box.textContent = role === 'student'
        ? 'Расписание и билет будут под рукой даже без интернета'
        : 'Кабинет будет открываться с главного экрана';
    }
    return box;
  }

  async function install() {
    const prompt = installPrompt;
    if (!prompt) return;
    installPrompt = null;
    await prompt.prompt();
    renderHints();
  }

  function renderHint(slot, role) {
    const canShow = !isInstalled() && !store('get', HINT_HIDDEN_KEY) && (installPrompt || isIos());
    slot.replaceChildren();
    slot.hidden = !canShow;
    if (!canShow) return;

    const hint = make('section', 'install-hint');
    hint.setAttribute('aria-label', 'Установка приложения');
    const icon = make('img', 'install-hint__icon');
    icon.src = '/img/logo.svg';
    icon.alt = '';
    const body = make('div', 'install-hint__body');
    body.append(make('p', 'install-hint__title', 'Установите кабинет как приложение'), hintDescription(role));
    if (installPrompt) {
      const button = make('button', 'button button--secondary button--small install-hint__button', 'Установить');
      button.type = 'button';
      button.addEventListener('click', install);
      body.append(button);
    }
    const close = make('button', 'install-hint__close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Скрыть подсказку');
    close.innerHTML = CLOSE_ICON; // наша постоянная иконка, не данные пользователя
    close.addEventListener('click', () => {
      store('set', HINT_HIDDEN_KEY, '1');
      renderHints();
    });
    hint.append(icon, body, close);
    slot.append(hint);
  }

  function renderHints() {
    for (const [slot, role] of hintSlots) renderHint(slot, role);
  }

  function mountInstallHint(slot, role) {
    if (!slot) return;
    hintSlots.set(slot, role);
    renderHint(slot, role);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // вместо всплывающей полосы браузера — наша спокойная подсказка
    installPrompt = event;
    renderHints();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    renderHints();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    });
  }

  return { signOut, signedIn, sessionConfirmed, mountInstallHint };
})();
