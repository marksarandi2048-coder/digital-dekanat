'use strict';
// Страница «Студенческий»: карточка билета и показ на весь экран.
// Все данные выводятся через textContent.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');
  const full = document.getElementById('card-full');
  const fullBody = document.getElementById('card-full-body');

  const CONCEPT = 'Концепт, не является документом';
  const QR_URL = '/api/student-card/qr.svg';

  function qrImage(className, size) {
    const img = el('img', className);
    img.src = QR_URL;
    img.alt = 'QR-код для проверки билета';
    img.width = size;
    img.height = size;
    return img;
  }

  const studyLine = (c) => [c.course ? `${c.course} курс` : null, c.group ? `группа ${c.group}` : null].filter(Boolean).join(' · ');

  function fact(dl, term, value) {
    dl.append(el('dt', null, term), el('dd', null, value));
  }

  function renderCard(c) {
    const card = el('article', 'stc');
    card.setAttribute('aria-label', 'Цифровой студенческий билет');

    const head = el('div', 'stc__head');
    const brand = el('span', 'stc__brand');
    const logo = el('img');
    logo.src = '/img/logo.svg';
    logo.alt = '';
    logo.width = 28;
    logo.height = 28;
    brand.append(logo, document.createTextNode('Цифровой деканат'));
    head.append(brand, el('span', 'stc__type', 'Студенческий билет'));

    const person = el('div', 'stc__person');
    const avatar = el('span', 'stc__avatar', c.initials);
    avatar.setAttribute('aria-hidden', 'true');
    const who = el('div', 'stc__who');
    who.append(el('p', 'stc__name', c.fullName), el('p', 'stc__line', c.faculty));
    if (studyLine(c)) who.append(el('p', 'stc__line', studyLine(c)));
    person.append(avatar, who);

    const bottom = el('div', 'stc__bottom');
    const facts = el('dl', 'stc__facts');
    fact(facts, 'Номер билета', c.number);
    fact(facts, 'Действует до', D.fullDate(c.validUntil));
    bottom.append(facts, qrImage('stc__qr', 112));

    card.append(head, person, bottom, el('p', 'stc-concept', CONCEPT));
    return card;
  }

  function fillFullScreen(c) {
    const title = el('p', 'stc-full__name', c.fullName);
    title.id = 'card-full-name';
    const line = [c.number, studyLine(c)].filter(Boolean).join(' · ');
    fullBody.replaceChildren(
      el('p', 'stc-full__brand', 'Цифровой деканат · студенческий билет'),
      qrImage('stc-full__qr', 320),
      title,
      el('p', 'stc-full__line', line),
      el('p', 'stc-concept stc-concept--full', CONCEPT),
    );
  }

  // ---------- На весь экран ----------
  // Экран не гаснет там, где браузер это умеет; яркость экрана сайт менять не может.
  let wakeLock = null;
  let inFullscreen = false;

  async function keepAwake() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      wakeLock = null; // не получилось — показ всё равно работает
    }
  }

  function openFull() {
    full.showModal();
    keepAwake();
    if (full.requestFullscreen) full.requestFullscreen().catch(() => {});
  }

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
  full.addEventListener('close', () => {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  });
  document.getElementById('card-full-close').addEventListener('click', () => full.close());

  async function load() {
    let data;
    try {
      data = await D.fetchJSON('/api/student-card');
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }
    if (!data.card) {
      content.replaceChildren(D.emptyState({
        illu: 'lost',
        title: 'Билет есть только у студентов',
        text: 'У сотрудника деканата студенческого билета нет.',
        action: { href: '/home', label: 'На главную', secondary: true },
      }));
    } else {
      const button = el('button', 'button stc-open', 'На весь экран');
      button.type = 'button';
      button.addEventListener('click', openFull);
      fillFullScreen(data.card);
      content.replaceChildren(
        renderCard(data.card),
        button,
        el('p', 'muted stc-hint', 'Покажите QR-код: при проверке откроется страница со статусом и сроком билета, без ваших личных данных.'),
      );
    }
    loading.hidden = true;
    content.hidden = false;
  }

  load();
})();
