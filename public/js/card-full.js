'use strict';
// Студенческий билет на весь экран. Открывается и со страницы билета, и из иконки
// в шапке на любой странице, поверх неё: после закрытия студент остаётся там же.
window.DekanatCardFull = (function () {
  const D = window.Dekanat;
  const el = D.el;
  const CONCEPT = 'Концепт, не является документом';
  const QR_URL = '/api/student-card/qr.svg';

  let full = null;
  let body = null;
  // Экран не гаснет там, где браузер это умеет; яркость экрана сайт менять не может.
  let wakeLock = null;
  let inFullscreen = false;

  const studyLine = (c) => [c.course ? `${c.course} курс` : null, c.group ? `группа ${c.group}` : null].filter(Boolean).join(' · ');

  function qrImage(className, size) {
    const img = el('img', className);
    img.src = QR_URL;
    img.alt = 'QR-код для проверки билета';
    img.width = size;
    img.height = size;
    return img;
  }

  async function keepAwake() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      wakeLock = null; // не получилось — показ всё равно работает
    }
  }

  function build() {
    full = el('dialog', 'stc-full');
    full.setAttribute('aria-label', 'Студенческий билет на весь экран');
    const close = el('button', 'sheet__close stc-full__close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть');
    // Наша постоянная иконка, не данные пользователя.
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', () => full.close());
    body = el('div', 'stc-full__body');
    full.append(close, body);
    full.addEventListener('close', () => {
      if (wakeLock) wakeLock.release().catch(() => {});
      wakeLock = null;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    });
    document.body.append(full);

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement === full) inFullscreen = true;
      else if (inFullscreen) {
        inFullscreen = false;
        if (full.open) full.close();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && full.open) keepAwake();
    });
  }

  function fill(c) {
    const line = [c.number, studyLine(c)].filter(Boolean).join(' · ');
    body.replaceChildren(
      el('p', 'stc-full__brand', 'Цифровой деканат · студенческий билет'),
      qrImage('stc-full__qr', 320),
      el('p', 'stc-full__name', c.fullName),
      el('p', 'stc-full__line', line),
      el('p', 'stc-concept stc-concept--full', CONCEPT),
    );
  }

  async function open() {
    if (!full) build();
    if (full.open) return;
    body.replaceChildren(el('p', 'stc-full__line', 'Загружаем билет…'));
    // Показываем сразу, пока идёт нажатие: так браузер разрешит настоящий полный экран.
    full.showModal();
    keepAwake();
    if (full.requestFullscreen) full.requestFullscreen().catch(() => {});

    let data;
    try {
      data = await D.fetchJSON('/api/student-card');
    } catch (err) {
      body.replaceChildren(el('p', 'stc-full__line', err.message));
      return;
    }
    if (data.card) fill(data.card);
    else body.replaceChildren(el('p', 'stc-full__line', 'Билет есть только у студентов.'));
  }

  const headerLink = document.getElementById('header-card');
  if (headerLink) {
    headerLink.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });
  }

  return { open, qrImage, studyLine, CONCEPT };
})();
