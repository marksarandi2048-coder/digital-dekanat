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
  let installedNow = false; // установили только что, в этой вкладке
  const hintSlots = new Map(); // подсказка на Главной: блок на странице → роль пользователя
  let appBlock = null; // постоянный блок «Приложение» в профиле

  const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIos = () => /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isChromium = () => /Chrome|Chromium|Edg\//.test(ua);
  // Safari на Mac: «Добавить в Dock» появилось в версии 17 (нужна macOS Sonoma или новее).
  function isMacSafariWithDock() {
    if (!/Macintosh/.test(ua) || isIos() || isChromium() || /Firefox|OPR\//.test(ua)) return false;
    const version = ua.match(/Version\/(\d+).*Safari\//);
    return Boolean(version) && Number(version[1]) >= 17;
  }

  // Как установить кабинет именно в этом браузере.
  function installWay() {
    if (installedNow || isInstalled()) return 'installed';
    if (installPrompt) return 'prompt';
    if (isIos()) return 'ios';
    if (isMacSafariWithDock()) return 'mac-safari';
    if (isChromium()) return 'browser-menu';
    return 'unsupported';
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  const benefit = (role) => (role === 'student'
    ? tr('pwa.raspisanie_i_bilet_budut')
    : tr('pwa.kabinet_budet_otkryvatsya_otdelno'));

  function instruction(way) {
    const box = make('p', 'install-hint__text');
    if (way === 'ios') {
      const share = make('span', 'install-hint__share');
      share.innerHTML = SHARE_ICON; // наша постоянная иконка, не данные пользователя
      box.append(tr('pwa.nazhmite'), share, tr('pwa.podelitsya_na_ekran_domoy'));
    } else if (way === 'mac-safari') {
      box.textContent = tr('pwa.v_menyu_safari_fayl');
    } else if (way === 'browser-menu') {
      box.textContent = tr('pwa.nazhmite_znachok_ustanovki_v');
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

  function installButton() {
    const button = make('button', 'button button--secondary button--small install-hint__button', tr('pwa.ustanovit'));
    button.type = 'button';
    button.addEventListener('click', install);
    return button;
  }

  // Подсказка на Главной: только если есть что предложить, и её можно скрыть насовсем.
  function renderHint(slot, role) {
    const way = installWay();
    // Chrome и Edge дают кнопку не сразу, а после действий на странице: до этого — инструкция.
    const canShow = ['prompt', 'ios', 'mac-safari', 'browser-menu'].includes(way) && !store('get', HINT_HIDDEN_KEY);
    slot.replaceChildren();
    slot.hidden = !canShow;
    if (!canShow) return;

    const hint = make('section', 'install-hint');
    hint.setAttribute('aria-label', tr('pwa.ustanovka_prilozheniya'));
    const icon = make('img', 'install-hint__icon');
    icon.src = '/img/logo.svg';
    icon.alt = '';
    const body = make('div', 'install-hint__body');
    const description = way === 'prompt' ? make('p', 'install-hint__text', benefit(role)) : instruction(way);
    body.append(make('p', 'install-hint__title', tr('pwa.ustanovite_kabinet_kak_prilozhenie')), description);
    if (way === 'prompt') body.append(installButton());
    const close = make('button', 'install-hint__close');
    close.type = 'button';
    close.setAttribute('aria-label', tr('pwa.skryt_podskazku'));
    close.innerHTML = CLOSE_ICON; // наша постоянная иконка, не данные пользователя
    close.addEventListener('click', () => {
      store('set', HINT_HIDDEN_KEY, '1');
      renderHints();
    });
    hint.append(icon, body, close);
    slot.append(hint);
  }

  // Блок «Приложение» в профиле: виден всегда, скрытая подсказка на него не влияет.
  function renderAppBlock() {
    if (!appBlock) return;
    const way = installWay();
    const lines = [];
    if (way === 'installed') {
      lines.push(make('p', 'app-block__text', tr('pwa.kabinet_ustanovlen_otkryvayte_ego')));
    } else {
      lines.push(make('p', 'app-block__text', benefit(appBlock.role)));
      if (way === 'prompt') lines.push(installButton());
      if (way === 'ios' || way === 'mac-safari' || way === 'browser-menu') lines.push(instruction(way));
      if (way === 'browser-menu') {
        lines.push(make('p', 'install-hint__text', tr('pwa.esli_kabinet_uzhe_ustanovlen')));
      }
      if (way === 'unsupported') {
        lines.push(make('p', 'install-hint__text', tr('pwa.chtoby_ustanovit_kabinet_otkroyte')));
      }
    }
    appBlock.body.replaceChildren(...lines);
    appBlock.section.hidden = false;
  }

  function renderHints() {
    for (const [slot, role] of hintSlots) renderHint(slot, role);
    renderAppBlock();
  }

  function mountInstallHint(slot, role) {
    if (!slot) return;
    hintSlots.set(slot, role);
    renderHint(slot, role);
  }

  function mountAppBlock(section, role) {
    if (!section) return;
    appBlock = { section, role, body: section.querySelector('.app-block__body') };
    renderAppBlock();
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // вместо всплывающей полосы браузера — наша спокойная подсказка
    installPrompt = event;
    renderHints();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installedNow = true;
    renderHints();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    });
  }

  return { signOut, signedIn, sessionConfirmed, mountInstallHint, mountAppBlock };
})();
