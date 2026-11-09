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
      side.append(renderCard(data.card), button);
      content.classList.add('stc-page');
      content.replaceChildren(side, renderHowTo());
    }
    loading.hidden = true;
    content.hidden = false;
  }

  load();
})();
