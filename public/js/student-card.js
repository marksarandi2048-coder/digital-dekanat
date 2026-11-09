'use strict';
// Страница «Студенческий»: карточка билета и подсказка, как им пользоваться.
// Все данные выводятся через textContent.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const Full = window.DekanatCardFull;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');

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
    if (Full.studyLine(c)) who.append(el('p', 'stc__line', Full.studyLine(c)));
    person.append(avatar, who);

    const bottom = el('div', 'stc__bottom');
    const facts = el('dl', 'stc__facts');
    fact(facts, 'Номер билета', c.number);
    fact(facts, 'Действует до', D.fullDate(c.validUntil));
    bottom.append(facts, Full.qrImage('stc__qr', 112));

    card.append(head, person, bottom, el('p', 'stc-concept', Full.CONCEPT));
    return card;
  }

  function renderHowTo() {
    const box = el('section', 'card stc-howto');
    box.setAttribute('aria-labelledby', 'stc-howto-title');
    const title = el('h2', 'section-title', 'Как пользоваться');
    title.id = 'stc-howto-title';
    const steps = el('ol', 'stc-howto__steps');
    for (const [head, text] of [
      ['Откройте билет', 'На телефоне — иконка билета в шапке, на компьютере — пункт «Студенческий» в меню.'],
      ['Покажите на весь экран', 'На телефоне фон станет ярким, а QR-код — крупным.'],
      ['Дайте отсканировать QR-код', 'Проверяющий увидит только статус и срок билета, без ваших личных данных.'],
    ]) {
      const li = el('li');
      li.append(el('strong', null, head), el('span', 'muted', text));
      steps.append(li);
    }
    const check = el('a', 'button button--secondary stc-howto__check', 'Проверить мой билет');
    check.href = '/student-card/check';
    check.target = '_blank';
    check.rel = 'noopener';
    box.append(title, steps, check, el('p', 'muted stc-howto__note', 'Откроется та же страница, что и у проверяющего.'));
    return box;
  }

  async function load() {
    let data;
    try {
      data = await D.fetchJSON('/api/student-card');
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.offline
        ? 'Нет подключения. Сохранённого билета на этом устройстве нет.'
        : err.message;
      if (err.offline) {
        D.offlineBar();
        D.reloadWhenOnline();
      }
      errorBox.hidden = false;
      return;
    }
    if (data.offlineSavedAt) {
      D.offlineBar(data.offlineSavedAt);
      D.reloadWhenOnline();
    }
    if (!data.card) {
      content.replaceChildren(D.emptyState({
        illu: 'lost',
        title: 'Билет есть только у студентов',
        text: 'У сотрудника деканата студенческого билета нет.',
        action: { href: '/home', label: 'На главную', secondary: true },
      }));
    } else {
      const side = el('div', 'stc-page__card');
      const button = el('button', 'button stc-open', 'На весь экран');
      button.type = 'button';
      button.addEventListener('click', Full.open);
      side.append(renderCard(data.card), button);
      content.classList.add('stc-page');
      content.replaceChildren(side, renderHowTo());
    }
    loading.hidden = true;
    content.hidden = false;
  }

  load();
})();
