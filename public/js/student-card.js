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
    card.setAttribute('aria-label', tr('student_card.tsifrovoy_studencheskiy_bilet'));

    const head = el('div', 'stc__head');
    const brand = el('span', 'stc__brand');
    const logo = el('img');
    logo.src = '/img/logo.svg';
    logo.alt = '';
    logo.width = 28;
    logo.height = 28;
    brand.append(logo, document.createTextNode(tr('student_card.tsifrovoy_dekanat')));
    head.append(brand, el('span', 'stc__type', tr('student_card.studencheskiy_bilet')));

    const person = el('div', 'stc__person');
    const avatar = el('span', 'stc__avatar', c.initials);
    avatar.setAttribute('aria-hidden', 'true');
    const who = el('div', 'stc__who');
    who.append(el('p', 'stc__name', c.fullName), el('p', 'stc__line', c.faculty));
    if (Full.studyLine(c)) who.append(el('p', 'stc__line', Full.studyLine(c)));
    person.append(avatar, who);

    const bottom = el('div', 'stc__bottom');
    const facts = el('dl', 'stc__facts');
    fact(facts, tr('student_card.nomer_bileta'), c.number);
    fact(facts, tr('student_card.deystvuet_do'), D.fullDate(c.validUntil));
    bottom.append(facts, Full.qrImage('stc__qr', 112));

    card.append(head, person, bottom, el('p', 'stc-concept', Full.CONCEPT));
    return card;
  }

  // Голограмма: блик плавно догоняет мышь, палец или наклон телефона.
  // При «Уменьшить движение» блик стоит на месте. Возвращает кнопку включения наклона (нужна только на iPhone).
  function setupHolo(card) {
    const holo = el('div', 'stc__holo');
    holo.setAttribute('aria-hidden', 'true');
    card.prepend(holo);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

    const REST = { x: 80, y: 16 }; // то же место, что в стилях: свободный угол, не на ФИО
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const target = { ...REST };
    const now = { ...REST };
    let frame = 0;

    function paint() {
      holo.style.setProperty('--hx', `${now.x.toFixed(1)}%`);
      holo.style.setProperty('--hy', `${now.y.toFixed(1)}%`);
      holo.style.setProperty('--bx', `${(100 - now.x).toFixed(1)}%`);
      holo.style.setProperty('--by', `${(100 - now.y).toFixed(1)}%`);
      holo.style.setProperty('--ha', `${((now.x - 50) * 0.5).toFixed(1)}deg`);
    }

    function tick() {
      now.x += (target.x - now.x) * 0.16;
      now.y += (target.y - now.y) * 0.16;
      paint();
      frame = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 0.1 ? window.requestAnimationFrame(tick) : 0;
    }

    function aim(x, y) {
      target.x = clamp(x, 0, 100);
      target.y = clamp(y, 0, 100);
      if (!frame) frame = window.requestAnimationFrame(tick);
    }

    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      aim(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
    });
    card.addEventListener('pointerleave', () => aim(REST.x, REST.y));

    if (!window.matchMedia('(pointer: coarse)').matches || !('DeviceOrientationEvent' in window)) return null;

    // Наклон отсчитывается от того, как телефон держали при первом показании.
    let baseBeta = null;
    let button = null;
    function onTilt(e) {
      if (e.gamma === null || e.beta === null) return;
      if (button) {
        button.remove(); // данные пошли — разрешение уже есть, кнопка не нужна
        button = null;
      }
      if (baseBeta === null) baseBeta = e.beta;
      aim(50 + (clamp(e.gamma, -30, 30) / 30) * 50, 50 + (clamp(e.beta - baseBeta, -25, 25) / 25) * 50);
    }
    window.addEventListener('deviceorientation', onTilt);

    if (typeof window.DeviceOrientationEvent.requestPermission !== 'function') return null;

    // На iPhone данные наклона приходят только после разрешения, а спросить можно лишь в ответ на нажатие.
    button = el('button', 'button-link stc-tilt', tr('student_card.vklyuchit_blik_naklon'));
    button.type = 'button';
    button.addEventListener('click', async () => {
      if (button) button.remove();
      button = null;
      try {
        await window.DeviceOrientationEvent.requestPermission();
      } catch {
        // нет разрешения — блик всё равно двигается от пальца
      }
    });
    return button;
  }

  function renderHowTo() {
    const box = el('section', 'card stc-howto');
    box.setAttribute('aria-labelledby', 'stc-howto-title');
    const title = el('h2', 'section-title', tr('student_card.kak_polzovatsya'));
    title.id = 'stc-howto-title';
    const steps = el('ol', 'stc-howto__steps');
    for (const [head, text] of [
      [tr('student_card.otkroyte_bilet'), tr('student_card.na_telefone_ikonka_bileta')],
      [tr('student_card.pokazhite_na_ves_ekran'), tr('student_card.na_telefone_fon_stanet')],
      [tr('student_card.dayte_otskanirovat_qr_kod'), tr('student_card.proveryayuschiy_uvidit_tolko_status')],
    ]) {
      const li = el('li');
      li.append(el('strong', null, head), el('span', 'muted', text));
      steps.append(li);
    }
    const check = el('a', 'button button--secondary stc-howto__check', tr('student_card.proverit_moy_bilet'));
    check.href = '/student-card/check';
    check.target = '_blank';
    check.rel = 'noopener';
    box.append(title, steps, check, el('p', 'muted stc-howto__note', tr('student_card.otkroetsya_ta_zhe_stranitsa')));
    return box;
  }

  async function load() {
    let data;
    try {
      data = await D.fetchJSON('/api/student-card');
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.offline
        ? tr('student_card.net_podklyucheniya_sokhranennogo_bileta')
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
        title: tr('student_card.bilet_est_tolko_u'),
        text: tr('student_card.u_sotrudnika_dekanata_studencheskogo'),
        action: { href: '/home', label: tr('student_card.na_glavnuyu'), secondary: true },
      }));
    } else {
      const side = el('div', 'stc-page__card');
      const button = el('button', 'button stc-open', tr('student_card.na_ves_ekran'));
      button.type = 'button';
      button.addEventListener('click', Full.open);
      const card = renderCard(data.card);
      const tiltButton = setupHolo(card);
      side.append(card);
      if (tiltButton) side.append(tiltButton);
      side.append(button);
      content.classList.add('stc-page');
      content.replaceChildren(side, renderHowTo());
    }
    loading.hidden = true;
    content.hidden = false;
  }

  load();
})();
